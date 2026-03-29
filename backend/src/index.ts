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
  rowToUser,
} from './mappers.js';
// Photo verification (delayed): uncomment imports + routes below when enabling AWS Rekognition.
// import {
//   compareProfilePhotoToSelfie,
//   imageReferenceToBuffer,
//   parseVerificationImageBody,
// } from './rekognitionCompare.js';
// import { profileHasVerifiablePhoto } from './profiles.js';
import { getOrCreateProfileId } from './profiles.js';
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

app.use(
  cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
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
  res.json(rowToUser(data as Parameters<typeof rowToUser>[0]));
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
  res.json(rowToUser(data as Parameters<typeof rowToUser>[0]));
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
  const { data: profiles, error: pErr } = await sb.from('profiles').select('*').in('id', ids);
  if (pErr) {
    res.status(400).json({ error: pErr.message });
    return;
  }
  const byId = new Map(
    (profiles ?? []).map((p: { id: string }) => [p.id, p] as const)
  );
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as Parameters<typeof rowToProfile>[0][];
  res.json(ordered.map((r) => rowToProfile(r)));
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

/* --- Verified-only featured list (delayed; use from Home when verification ships) ---
app.get('/api/profiles/featured', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('is_verified', true)
    .neq('id', user.profileId)
    .order('updated_at', { ascending: false })
    .limit(24);
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  const rows = (data ?? []) as Parameters<typeof rowToProfile>[0][];
  res.json(rows.map((r) => rowToProfile(r)));
});
--- */

app.get('/api/profiles', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('profiles').select('*').neq('id', user.profileId);
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  const rows = (data ?? []) as Parameters<typeof rowToProfile>[0][];
  res.json(rows.map((r) => rowToProfile(r)));
});

app.get('/api/chat/conversations', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
  const me = user.profileId;
  const { data: rows, error } = await sb
    .from('messages')
    .select('sender_id, receiver_id, body, created_at')
    .or(`sender_id.eq.${me},receiver_id.eq.${me}`)
    .order('created_at', { ascending: false })
    .limit(500);
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
    const partner = s === me ? r : s;
    if (seen.has(partner)) continue;
    seen.add(partner);
    partnerOrder.push(partner);
    latest.set(partner, { body: String(row.body), created_at: String(row.created_at) });
  }
  if (partnerOrder.length === 0) {
    res.json([]);
    return;
  }
  const { data: profiles, error: pErr } = await sb.from('profiles').select('*').in('id', partnerOrder);
  if (pErr) {
    res.status(400).json({ error: pErr.message });
    return;
  }
  const byId = new Map(
    (profiles ?? []).map((p: { id: string }) => [p.id, p] as const)
  );
  const list = partnerOrder
    .map((pid) => {
      const p = byId.get(pid) as Parameters<typeof rowToProfile>[0] | undefined;
      const l = latest.get(pid);
      if (!p || !l) return null;
      return {
        partner: rowToProfile(p),
        lastMessage: l.body,
        time: l.created_at,
      };
    })
    .filter(Boolean);
  res.json(list);
});

app.get('/api/chat/:partnerId/messages', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const partnerId = req.params.partnerId;
  const sb = getSupabaseAdmin();
  const me = user.profileId;
  const { data, error } = await sb
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${me},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${me})`)
    .order('created_at', { ascending: true });
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
  res.json(rowToMessage(data as Parameters<typeof rowToMessage>[0], user.profileId));
});

app.get('/api/notifications', async (req, res) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  const sb = getSupabaseAdmin();
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
  res.json(rows.map((r) => rowToNotification(r)));
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

app.listen(port, () => {
  console.log(`Namdev Connect API at http://localhost:${port}`);
});
