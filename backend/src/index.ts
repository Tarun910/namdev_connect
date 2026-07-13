import { clerkMiddleware, getAuth } from '@clerk/express';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  patchBodyToRow,
  rowToMessage,
  rowToNotification,
  rowToProfile,
  rowToProfileCard,
  LIST_PROFILE_SELECT,
  rowToUser,
} from './mappers.js';
// Photo verification (delayed): uncomment imports + routes below when enabling AWS Rekognition.
// import {
//   compareProfilePhotoToSelfie,
//   imageReferenceToBuffer,
//   parseVerificationImageBody,
// } from './rekognitionCompare.js';
// import { profileHasVerifiablePhoto } from './profiles.js';
import {
  fetchConversationPreviewRows,
  fetchMessagesBetween,
  markIncomingFromPartnerRead,
  uuidKeysEqual,
} from './chatQueries.js';
import { broadcastMessagesRead, broadcastNewChatMessage } from './chatRealtime.js';
import { getOrCreateProfileId } from './profiles.js';
import {
  loadViewerRowsById,
  recordProfileView,
  viewerPreviewFromRow,
  blurVisitorName,
} from './profileViews.js';
import {
  activateSubscription,
  buildEntitlements,
  checkChatAccess,
  DISCOVER_FILTER_SELECT,
  filterDiscoverableRows,
  hasAcceptedInterest,
  LIMITS,
  PLANS,
  resolveIsPremium,
  type PremiumPlanId,
} from './entitlements.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

if (!process.env.CLERK_PUBLISHABLE_KEY?.trim()) {
  console.warn(
    '[clerk] CLERK_PUBLISHABLE_KEY is missing. Add it to backend/.env.local (same pk_… value as frontend VITE_CLERK_PUBLISHABLE_KEY).'
  );
}
if (!process.env.CLERK_SECRET_KEY?.trim()) {
  console.warn(
    '[clerk] CLERK_SECRET_KEY is missing. @clerk/express will fail every protected route with HTTP 500 until you add the secret key from Clerk Dashboard → API keys.'
  );
}

const app = express();
const port = Number(process.env.PORT) || 5000;

function corsAllowedOrigins(): Set<string> {
  const out = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...String(process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    ...String(process.env.FRONTEND_URL ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ]);
  return out;
}

const _corsAllow = corsAllowedOrigins();

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (_corsAllow.has(origin)) return cb(null, true);
      try {
        const host = new URL(origin).hostname;
        if (host === 'localhost' || host === '127.0.0.1') return cb(null, true);
        // Production frontends on Vercel (preview + production deployments)
        if (host.endsWith('.vercel.app')) return cb(null, true);
      } catch {
        /* invalid Origin */
      }
      cb(null, false);
    },
    credentials: true,
  })
);
// Default ~100kb is too small for profile PATCH with several base64 thumbnails (until you use object storage).
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '25mb' }));

function checkSupabase(): { ok: true } | { ok: false; message: string } {
  try {
    getSupabaseAdmin();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Supabase admin not configured' };
  }
}

/** Registered before Clerk so misconfigured keys still show this page (Clerk middleware throws without secret key). */
app.get('/', (_req, res) => {
  const sb = checkSupabase();
  const clerkPk = Boolean(process.env.CLERK_PUBLISHABLE_KEY?.trim());
  const clerkSk = Boolean(process.env.CLERK_SECRET_KEY?.trim());
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Namdev Connect API</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:2rem;line-height:1.5">
  <h1>Namdev Connect API</h1>
  <p>Auth: <strong>Clerk</strong> (Bearer session token). Data: <strong>Supabase</strong> (service role on server).</p>
  <p>CLERK_PUBLISHABLE_KEY: <strong>${clerkPk ? 'set' : 'missing'}</strong> (required by <code>@clerk/express</code>)</p>
  <p>CLERK_SECRET_KEY: <strong>${clerkSk ? 'set' : 'missing'}</strong> (required — without it, <code>/api/*</code> returns 500)</p>
  <p>Supabase admin: <strong>${sb.ok ? 'ok' : sb.message}</strong></p>
  <p>App: <a href="http://localhost:3000">http://localhost:3000</a></p>
  <p><a href="/api/health"><code>GET /api/health</code></a></p>
</body>
</html>`);
});

app.get('/api/health', async (_req, res) => {
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from('profiles').select('id').limit(1);
    if (error) {
      res.status(500).json({ ok: false, db: error.message, code: error.code });
      return;
    }
    res.json({ ok: true, db: 'ok' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Supabase check failed';
    res.status(500).json({ ok: false, db: msg });
  }
});

app.use(clerkMiddleware());

function profileSetupErrorMessage(e: unknown): string {
  const raw =
    e instanceof Error
      ? e.message
      : e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
        ? (e as { message: string }).message
        : String(e);

  let hint =
    'In Supabase → SQL Editor, run supabase/migrations/001_initial_schema.sql, then supabase/migrations/002_clerk_auth.sql (in order). Restart the API after env changes.';
  if (/SUPABASE|service role|Missing SUPABASE/i.test(raw)) {
    hint =
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.local. The value must be the service_role secret from Supabase Project Settings → API (not the anon key).';
  } else if (/row-level security|RLS|42501|permission denied/i.test(raw)) {
    hint =
      'Database blocked the insert (RLS). Use the service_role key in SUPABASE_SERVICE_ROLE_KEY, not the anon public key.';
  } else if (/schema cache/i.test(raw)) {
    hint =
      'Run supabase/manual/fix_clerk_user_id_schema_cache.sql in Supabase SQL Editor (adds clerk_user_id if needed + NOTIFY pgrst). Wait 15–30s, Retry. If profiles already shows that column in Table Editor, you only needed the NOTIFY — same script. Use the project that matches SUPABASE_URL.';
  } else if (/column|does not exist|42703/i.test(raw)) {
    hint =
      'Run supabase/migrations/002_clerk_auth.sql in the SQL Editor (after 001 if tables are new). See also supabase/manual/fix_clerk_user_id_schema_cache.sql.';
  }

  return `Could not load user profile (${raw}). ${hint}`;
}

async function requireApiUser(req: Request, res: Response): Promise<{ profileId: string } | null> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  try {
    const profileId = await getOrCreateProfileId(userId);
    return { profileId };
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: profileSetupErrorMessage(e) });
    return null;
  }
}

app.get('/api/profile/me', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('profiles').select('*').eq('id', user.profileId).single();
  if (error || !data) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  const entitlements = await buildEntitlements(sb, user.profileId);
  res.json({ ...rowToUser(data as Parameters<typeof rowToUser>[0]), entitlements });
});

app.patch('/api/profile/me', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const patch = patchBodyToRow(req.body ?? {});
  const { data, error } = await sb
    .from('profiles')
    .update(patch)
    .eq('id', user.profileId)
    .select('*')
    .single();
  if (error || !data) {
    res.status(400).json({ error: error?.message ?? 'Update failed' });
    return;
  }
  const entitlements = await buildEntitlements(sb, user.profileId);
  res.json({ ...rowToUser(data as Parameters<typeof rowToUser>[0]), entitlements });
});

app.post('/api/membership/subscribe', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const plan = (req.body as { plan?: string })?.plan;
  if (!plan || !(plan in PLANS)) {
    res.status(400).json({
      error: 'Invalid plan. Choose monthly, 6months, or 12months.',
      code: 'INVALID_PLAN',
    });
    return;
  }
  const sb = getSupabaseAdmin();
  try {
    const { expiresAt, plan: activatedPlan } = await activateSubscription(
      sb,
      user.profileId,
      plan as PremiumPlanId
    );
    const entitlements = await buildEntitlements(sb, user.profileId);
    res.json({
      ok: true,
      plan: activatedPlan,
      priceInr: PLANS[activatedPlan].priceInr,
      expiresAt,
      entitlements,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Subscription failed' });
  }
});

/* --- Photo verification API (delayed; enable with rekognitionCompare + env) ---
app.post('/api/profile/verify-photo', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const verificationImage = (req.body as { verificationImage?: string })?.verificationImage;
  if (!verificationImage || typeof verificationImage !== 'string') {
    res.status(400).json({
      error:
        'verificationImage is required: a JPG/PNG data URL or base64 of a live selfie taken now.',
    });
    return;
  }

  let selfieBytes: Buffer;
  try {
    selfieBytes = parseVerificationImageBody(verificationImage);
  } catch {
    res.status(400).json({ error: 'Invalid verification image encoding.' });
    return;
  }
  if (selfieBytes.length < 800) {
    res.status(400).json({ error: 'Verification image is too small or empty.' });
    return;
  }
  if (selfieBytes.length > 12 * 1024 * 1024) {
    res.status(400).json({ error: 'Verification image is too large (max 12MB).' });
    return;
  }

  const sb = getSupabaseAdmin();
  const { data: row, error: fetchErr } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.profileId)
    .single();
  if (fetchErr || !row) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  if (!profileHasVerifiablePhoto(row as { image_url: string; gallery_urls?: string[] | null })) {
    res.status(400).json({
      error:
        'Add a clear profile photo of yourself (replace the default placeholder or upload images), save your profile, then try again.',
    });
    return;
  }
  const already = Boolean((row as { is_verified?: boolean }).is_verified);
  if (already) {
    res.json(rowToUser(row as Parameters<typeof rowToUser>[0]));
    return;
  }

  const profileUrl = String((row as { image_url: string }).image_url ?? '').trim();
  let profileBytes: Buffer;
  try {
    profileBytes = await imageReferenceToBuffer(profileUrl);
  } catch {
    res.status(400).json({
      error: 'Could not load your profile picture. Save your profile with a valid photo and try again.',
    });
    return;
  }

  const match = await compareProfilePhotoToSelfie(profileBytes, selfieBytes);
  if (!match.ok) {
    const status = match.code === 'config' ? 503 : 400;
    res.status(status).json({ error: match.message });
    return;
  }

  const { data: updated, error: upErr } = await sb
    .from('profiles')
    .update({ is_verified: true, updated_at: new Date().toISOString() })
    .eq('id', user.profileId)
    .select('*')
    .single();
  if (upErr || !updated) {
    res.status(400).json({ error: upErr?.message ?? 'Verification failed' });
    return;
  }
  res.json(rowToUser(updated as Parameters<typeof rowToUser>[0]));
});
--- */

app.get('/api/profile/:id', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const targetId = req.params.id;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('profiles').select('*').eq('id', targetId).single();
  if (error || !data) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  let isSaved = false;
  if (targetId !== user.profileId) {
    const { data: fav } = await sb
      .from('saved_interests')
      .select('id')
      .eq('user_id', user.profileId)
      .eq('target_profile_id', targetId)
      .maybeSingle();
    isSaved = Boolean(fav);
  }
  const profile = rowToProfile(data as Parameters<typeof rowToProfile>[0]);
  res.json({ ...profile, isSaved });
});

app.get('/api/profile/:id/contact', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const targetId = req.params.id;
  if (targetId === user.profileId) {
    res.status(400).json({ error: 'Cannot view your own contact via this route', code: 'INVALID' });
    return;
  }
  const sb = getSupabaseAdmin();
  const entitlements = await buildEntitlements(sb, user.profileId);
  if (!entitlements.canSeeContact) {
    res.status(402).json({
      error: 'Contact details are available for Premium members.',
      code: 'PREMIUM_REQUIRED',
    });
    return;
  }
  const accepted = await hasAcceptedInterest(sb, user.profileId, targetId);
  if (!accepted) {
    res.status(403).json({
      error: 'Contact is available after interest is mutually accepted.',
      code: 'INTEREST_NOT_ACCEPTED',
    });
    return;
  }
  const { data, error } = await sb
    .from('profiles')
    .select('phone, email')
    .eq('id', targetId)
    .single();
  if (error || !data) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  const row = data as { phone?: string | null; email?: string | null };
  res.json({
    phone: row.phone?.trim() || null,
    email: row.email?.trim() || null,
  });
});

app.get('/api/premium/kundli/:partnerId', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const entitlements = await buildEntitlements(sb, user.profileId);
  if (!entitlements.canUseKundli) {
    res.status(402).json({
      error: 'Kundli Milan is a Premium feature.',
      code: 'PREMIUM_REQUIRED',
    });
    return;
  }
  res.json({ ok: true });
});

app.get('/api/premium/compatibility/:partnerId', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const entitlements = await buildEntitlements(sb, user.profileId);
  if (!entitlements.canUseCompatibility) {
    res.status(402).json({
      error: 'AI Compatibility is a Premium feature.',
      code: 'PREMIUM_REQUIRED',
    });
    return;
  }
  res.json({ ok: true });
});

app.post('/api/profile/:id/view', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const viewedId = req.params.id;
  if (viewedId === user.profileId) {
    res.json({ ok: true });
    return;
  }
  const sb = getSupabaseAdmin();
  const { data: target, error } = await sb.from('profiles').select('id').eq('id', viewedId).maybeSingle();
  if (error || !target) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  try {
    await recordProfileView(sb, user.profileId, viewedId);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not record view' });
  }
});

app.get('/api/saved-interests', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const { data: rows, error } = await sb
    .from('saved_interests')
    .select('target_profile_id, created_at')
    .eq('user_id', user.profileId)
    .order('created_at', { ascending: false });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  const ids = (rows ?? []).map((r: { target_profile_id: string }) => r.target_profile_id);
  if (ids.length === 0) {
    res.json([]);
    return;
  }
  const { data: profiles, error: pErr } = await sb.from('profiles').select(LIST_PROFILE_SELECT).in('id', ids);
  if (pErr) {
    res.status(400).json({ error: pErr.message });
    return;
  }
  const byId = new Map(
    (profiles ?? []).map((p: { id: string }) => [p.id, p] as const)
  );
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as Parameters<typeof rowToProfile>[0][];
  res.json(ordered.map((r) => rowToProfileCard(r)));
});

app.post('/api/saved-interests', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const targetProfileId = (req.body as { targetProfileId?: string })?.targetProfileId;
  if (!targetProfileId || typeof targetProfileId !== 'string') {
    res.status(400).json({ error: 'targetProfileId required' });
    return;
  }
  if (targetProfileId === user.profileId) {
    res.status(400).json({ error: 'Cannot save your own profile' });
    return;
  }
  const sb = getSupabaseAdmin();
  const entitlements = await buildEntitlements(sb, user.profileId);
  if (!entitlements.isPremium) {
    const { count } = await sb
      .from('saved_interests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.profileId);
    if ((count ?? 0) >= LIMITS.FREE_SAVED) {
      res.status(402).json({
        error: `Free plan allows up to ${LIMITS.FREE_SAVED} saved profiles. Upgrade for unlimited saves.`,
        code: 'SAVE_LIMIT',
        limit: LIMITS.FREE_SAVED,
      });
      return;
    }
  }
  const { error } = await sb.from('saved_interests').insert({
    user_id: user.profileId,
    target_profile_id: targetProfileId,
  });
  if (error) {
    if (error.code === '23505') {
      res.json({ ok: true });
      return;
    }
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

app.delete('/api/saved-interests/:targetProfileId', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('saved_interests')
    .delete()
    .eq('user_id', user.profileId)
    .eq('target_profile_id', req.params.targetProfileId);
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

async function profileFirstName(sb: ReturnType<typeof getSupabaseAdmin>, profileId: string): Promise<string> {
  const { data } = await sb.from('profiles').select('name').eq('id', profileId).maybeSingle();
  const n = data && typeof (data as { name?: string }).name === 'string' ? (data as { name: string }).name.trim() : '';
  if (n && n !== 'Member') return (n.split(/\s+/)[0] ?? n) as string;
  return 'Someone';
}

/** Send or re-send interest (pending). Idempotent if already pending. */
app.post('/api/interest-requests', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const toProfileId = (req.body as { toProfileId?: string })?.toProfileId;
  if (!toProfileId || typeof toProfileId !== 'string') {
    res.status(400).json({ error: 'toProfileId required' });
    return;
  }
  if (toProfileId === user.profileId) {
    res.status(400).json({ error: 'Cannot send interest to yourself' });
    return;
  }
  const sb = getSupabaseAdmin();
  const senderEnt = await buildEntitlements(sb, user.profileId);
  if (!senderEnt.discoverable) {
    res.status(403).json({
      error: `Complete your basic profile (name, location, profession, education, photo) to send interest.`,
      code: 'PROFILE_INCOMPLETE',
    });
    return;
  }

  const { data: target, error: tErr } = await sb.from('profiles').select('id').eq('id', toProfileId).maybeSingle();
  if (tErr || !target) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const { data: existing, error: exErr } = await sb
    .from('interest_requests')
    .select('id, status')
    .eq('from_user_id', user.profileId)
    .eq('to_user_id', toProfileId)
    .maybeSingle();
  if (exErr) {
    res.status(400).json({ error: exErr.message });
    return;
  }

  let requestId: string;
  const nowIso = new Date().toISOString();
  if (existing) {
    if (existing.status === 'pending') {
      res.json({ id: existing.id as string, status: 'pending' });
      return;
    }
    if (existing.status === 'accepted') {
      res.status(400).json({ error: 'Interest already accepted' });
      return;
    }
    const { data: updated, error: upErr } = await sb
      .from('interest_requests')
      .update({ status: 'pending', updated_at: nowIso })
      .eq('id', existing.id)
      .select('id')
      .single();
    if (upErr || !updated) {
      res.status(400).json({ error: upErr?.message ?? 'Could not update request' });
      return;
    }
    requestId = updated.id as string;
  } else {
    if (
      !senderEnt.isPremium &&
      senderEnt.interestsRemaining !== null &&
      senderEnt.interestsRemaining <= 0
    ) {
      res.status(402).json({
        error: `Free plan includes ${LIMITS.FREE_INTERESTS_PER_MONTH} interests per month. Upgrade for unlimited.`,
        code: 'INTEREST_LIMIT',
        limit: LIMITS.FREE_INTERESTS_PER_MONTH,
      });
      return;
    }
    const { data: inserted, error: insErr } = await sb
      .from('interest_requests')
      .insert({
        from_user_id: user.profileId,
        to_user_id: toProfileId,
        status: 'pending',
        updated_at: nowIso,
      })
      .select('id')
      .single();
    if (insErr || !inserted) {
      res.status(400).json({ error: insErr?.message ?? 'Could not create request' });
      return;
    }
    requestId = inserted.id as string;
  }

  const fromName = await profileFirstName(sb, user.profileId);
  await sb.from('notifications').insert({
    user_id: toProfileId,
    title: 'New interest',
    body: `${fromName} sent you an interest request. Open Notifications to accept or decline.`,
    time_label: 'Just now',
    is_read: false,
    type: 'interest',
  });

  res.json({ id: requestId, status: 'pending' });
});

app.get('/api/interest-requests/incoming', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const { data: rows, error } = await sb
    .from('interest_requests')
    .select('id, from_user_id, status, created_at')
    .eq('to_user_id', user.profileId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  const ids = (rows ?? []).map((r: { from_user_id: string }) => r.from_user_id);
  if (ids.length === 0) {
    res.json([]);
    return;
  }
  const { data: profs, error: pErr } = await sb.from('profiles').select(LIST_PROFILE_SELECT).in('id', ids);
  if (pErr) {
    res.status(400).json({ error: pErr.message });
    return;
  }
  const byId = new Map((profs ?? []).map((p: { id: string }) => [p.id, p] as const));
  const list = (rows ?? []).map((r: { id: string; from_user_id: string; created_at: string }) => {
    const pr = byId.get(r.from_user_id) as Parameters<typeof rowToProfile>[0] | undefined;
    return {
      id: r.id,
      createdAt: r.created_at,
      fromProfile: pr ? rowToProfileCard(pr) : null,
    };
  });
  res.json(list.filter((x) => x.fromProfile));
});

app.get('/api/interest-requests/sent/:targetProfileId', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const targetId = req.params.targetProfileId;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('interest_requests')
    .select('id, status')
    .eq('from_user_id', user.profileId)
    .eq('to_user_id', targetId)
    .maybeSingle();
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.json({ status: 'none', id: null });
    return;
  }
  res.json({ status: (data as { status: string }).status, id: (data as { id: string }).id });
});

app.post('/api/interest-requests/:id/accept', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const { data: row, error: fErr } = await sb
    .from('interest_requests')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (fErr || !row) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }
  const r = row as { to_user_id: string; from_user_id: string; status: string };
  if (r.to_user_id !== user.profileId) {
    res.status(403).json({ error: 'Not allowed' });
    return;
  }
  if (r.status !== 'pending') {
    res.status(400).json({ error: 'Request is not pending' });
    return;
  }
  const nowIso = new Date().toISOString();
  const { error: uErr } = await sb
    .from('interest_requests')
    .update({ status: 'accepted', updated_at: nowIso })
    .eq('id', req.params.id);
  if (uErr) {
    res.status(400).json({ error: uErr.message });
    return;
  }
  const accepterName = await profileFirstName(sb, user.profileId);
  await sb.from('notifications').insert({
    user_id: r.from_user_id,
    title: 'Interest accepted',
    body: `${accepterName} accepted your interest. Upgrade to Premium to start chatting.`,
    time_label: 'Just now',
    is_read: false,
    type: 'interest',
  });
  res.json({ ok: true, status: 'accepted' });
});

app.post('/api/interest-requests/:id/reject', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const { data: row, error: fErr } = await sb
    .from('interest_requests')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (fErr || !row) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }
  const r = row as { to_user_id: string; from_user_id: string; status: string };
  if (r.to_user_id !== user.profileId) {
    res.status(403).json({ error: 'Not allowed' });
    return;
  }
  if (r.status !== 'pending') {
    res.status(400).json({ error: 'Request is not pending' });
    return;
  }
  const nowIso = new Date().toISOString();
  const { error: uErr } = await sb
    .from('interest_requests')
    .update({ status: 'rejected', updated_at: nowIso })
    .eq('id', req.params.id);
  if (uErr) {
    res.status(400).json({ error: uErr.message });
    return;
  }
  const rejectorName = await profileFirstName(sb, user.profileId);
  await sb.from('notifications').insert({
    user_id: r.from_user_id,
    title: 'Interest declined',
    body: `${rejectorName} declined your interest request.`,
    time_label: 'Just now',
    is_read: false,
    type: 'interest',
  });
  res.json({ ok: true, status: 'rejected' });
});

/* Featured profiles for home — discoverable profiles only (60%+ complete). */
app.get('/api/profiles/featured', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 8));
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('profiles')
    .select(DISCOVER_FILTER_SELECT)
    .neq('id', user.profileId)
    .order('updated_at', { ascending: false })
    .limit(limit * 3);
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  const eligible = filterDiscoverableRows(
    (data ?? []) as Parameters<typeof rowToProfileCard>[0][]
  ).slice(0, limit);
  res.json(eligible.map((r) => rowToProfileCard(r)));
});

app.get('/api/profiles', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('profiles')
    .select(DISCOVER_FILTER_SELECT)
    .neq('id', user.profileId)
    .order('updated_at', { ascending: false })
    .limit(240);
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  const eligible = filterDiscoverableRows(
    (data ?? []) as Parameters<typeof rowToProfileCard>[0][]
  ).slice(0, 80);
  res.json(eligible.map((r) => rowToProfileCard(r)));
});

app.get('/api/chat/conversations', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const me = user.profileId;
  const { data: rows, error } = await fetchConversationPreviewRows(sb, me);
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  const seen = new Set<string>();
  const partnerOrder: string[] = [];
  const latest = new Map<string, { body: string; created_at: string }>();
  for (const row of rows ?? []) {
    const s = row.sender_id as string;
    const r = row.receiver_id as string;
    const partner = uuidKeysEqual(s, me) ? r : s;
    if (uuidKeysEqual(partner, me)) continue;
    const dedupeKey = partner.trim().toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    partnerOrder.push(partner);
    latest.set(dedupeKey, { body: String(row.body), created_at: String(row.created_at) });
  }
  if (partnerOrder.length === 0) {
    res.json([]);
    return;
  }
  const { data: profiles, error: pErr } = await sb.from('profiles').select(LIST_PROFILE_SELECT).in('id', partnerOrder);
  if (pErr) {
    res.status(400).json({ error: pErr.message });
    return;
  }
  const byIdNorm = new Map<string, Parameters<typeof rowToProfile>[0]>();
  for (const row of profiles ?? []) {
    const p = row as Parameters<typeof rowToProfile>[0];
    byIdNorm.set(p.id.trim().toLowerCase(), p);
  }
  const meNorm = me.trim().toLowerCase();

  const { data: unreadRows, error: unreadErr } = await sb
    .from('messages')
    .select('sender_id')
    .eq('receiver_id', me)
    .is('read_at', null);
  if (unreadErr) {
    res.status(400).json({ error: unreadErr.message });
    return;
  }
  const unreadBySender = new Map<string, number>();
  for (const u of unreadRows ?? []) {
    const sid = String((u as { sender_id: string }).sender_id).trim().toLowerCase();
    unreadBySender.set(sid, (unreadBySender.get(sid) ?? 0) + 1);
  }

  const list = partnerOrder
    .map((pid) => {
      const k = pid.trim().toLowerCase();
      const p = byIdNorm.get(k);
      const l = latest.get(k);
      if (!p || !l) return null;
      const partner = rowToProfileCard(p);
      if (partner.id.trim().toLowerCase() === meNorm) return null;
      return {
        partner,
        lastMessage: l.body,
        time: l.created_at,
        unreadCount: unreadBySender.get(k) ?? 0,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  res.json(list);
});

app.get('/api/chat/unread-count', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', user.profileId)
    .is('read_at', null);
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ total: count ?? 0 });
});

app.get('/api/chat/:partnerId/messages', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const partnerId = req.params.partnerId;
  const sb = getSupabaseAdmin();
  const me = user.profileId;

  const access = await checkChatAccess(sb, me, partnerId);
  if (!access.allowed) {
    res.status(access.status).json({ error: access.error, code: access.code });
    return;
  }

  const { updated: markedRead, error: markErr } = await markIncomingFromPartnerRead(sb, me, partnerId);
  if (markErr) {
    res.status(400).json({ error: markErr.message });
    return;
  }
  if (markedRead > 0) {
    void broadcastMessagesRead(sb, me, partnerId, { reader_id: me });
  }

  const { data, error } = await fetchMessagesBetween(sb, me, partnerId);
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  const rows = (data ?? []) as Parameters<typeof rowToMessage>[0][];
  res.json(rows.map((r) => rowToMessage(r, me)));
});

app.post('/api/chat/messages', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const { receiverId, text } = req.body ?? {};
  if (!receiverId || !text) {
    res.status(400).json({ error: 'receiverId and text required' });
    return;
  }
  const sb = getSupabaseAdmin();
  const access = await checkChatAccess(sb, user.profileId, String(receiverId));
  if (!access.allowed) {
    res.status(access.status).json({ error: access.error, code: access.code });
    return;
  }
  const { data, error } = await sb
    .from('messages')
    .insert({
      sender_id: user.profileId,
      receiver_id: receiverId,
      body: String(text),
    })
    .select('*')
    .single();
  if (error || !data) {
    res.status(400).json({ error: error?.message ?? 'Insert failed' });
    return;
  }
  const inserted = data as Parameters<typeof rowToMessage>[0];
  void broadcastNewChatMessage(sb, user.profileId, receiverId, {
    id: inserted.id,
    sender_id: inserted.sender_id,
    receiver_id: inserted.receiver_id,
    body: inserted.body,
    created_at: inserted.created_at,
    read_at: (inserted as { read_at?: string | null }).read_at ?? null,
  });
  res.json(rowToMessage(inserted, user.profileId));
});

app.get('/api/notifications', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  let meRow: { is_premium?: boolean | null; premium_expires_at?: string | null } | null = null;
  const { data: meFull, error: meFullErr } = await sb
    .from('profiles')
    .select('is_premium, premium_expires_at')
    .eq('id', user.profileId)
    .single();
  if (meFullErr && /column|does not exist|42703/i.test(meFullErr.message)) {
    const { data: meLegacy, error: meLegacyErr } = await sb
      .from('profiles')
      .select('is_premium')
      .eq('id', user.profileId)
      .single();
    if (meLegacyErr) {
      res.status(400).json({ error: meLegacyErr.message });
      return;
    }
    meRow = meLegacy as { is_premium?: boolean | null };
  } else if (meFullErr) {
    res.status(400).json({ error: meFullErr.message });
    return;
  } else {
    meRow = meFull as { is_premium?: boolean | null; premium_expires_at?: string | null };
  }
  const isPremium = resolveIsPremium(meRow);

  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .eq('user_id', user.profileId)
    .order('created_at', { ascending: false });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  const rows = (data ?? []) as Parameters<typeof rowToNotification>[0][];
  const viewerIds = rows
    .filter((r) => r.type === 'profile_view' && r.viewer_profile_id)
    .map((r) => String(r.viewer_profile_id));
  const viewersById = await loadViewerRowsById(sb, viewerIds);

  const out = rows.map((r) => {
    const base = rowToNotification(r);
    if (r.type !== 'profile_view' || !r.viewer_profile_id) return base;
    const viewerRow = viewersById.get(String(r.viewer_profile_id));
    if (!viewerRow) {
      return {
        ...base,
        body: isPremium ? base.body : 'Someone viewed your profile',
        viewer: {
          name: blurVisitorName('Someone'),
          imageUrl: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=200&h=200&fit=crop&blur=10',
          blurred: true,
        },
      };
    }
    const viewer = viewerPreviewFromRow(viewerRow, isPremium);
    return {
      ...base,
      body: isPremium
        ? `${viewer.name} viewed your profile`
        : `${viewer.name} viewed your profile — upgrade to see who`,
      viewer,
    };
  });
  res.json(out);
});

app.post('/api/notifications/mark-read', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.profileId);
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

app.use((err: unknown, req: Request, res: Response, _next: express.NextFunction) => {
  console.error(err);
  const payloadStatus =
    err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined;
  const errMsg = err instanceof Error ? err.message : String(err);
  if (
    payloadStatus === 413 ||
    /request entity too large|payload too large|too large/i.test(errMsg)
  ) {
    res.status(413).json({
      error:
        'Request too large for the server (too many or heavy images). Save fewer photos per update, or set JSON_BODY_LIMIT in backend (default is 25mb). Long term: use Supabase Storage + URLs.',
    });
    return;
  }
  const msg = err instanceof Error ? err.message : 'Internal server error';
  if (req.path.startsWith('/api')) {
    res.status(500).json({ error: msg });
    return;
  }
  res.status(500).type('html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head><body><pre>${escapeHtml(msg)}</pre></body></html>`);
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Namdev Connect API at http://0.0.0.0:${port}`);
});
