import { getSupabaseAdmin } from './supabaseAdmin.js';

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

export const LIMITS = {
  /** Minimum filled sections (of 9) to appear in Discover — basic profile complete. */
  DISCOVER_MIN_FIELDS: 5,
  DISCOVER_MIN_PERCENT: 60,
  FREE_SAVED: 15,
  FREE_INTERESTS_PER_MONTH: 5,
} as const;

export const PLANS = {
  monthly: { label: '1 Month', priceInr: 499, days: 30 },
  '6months': { label: '6 Months', priceInr: 2499, days: 183 },
  '12months': { label: '12 Months', priceInr: 4499, days: 365 },
} as const;

export type PremiumPlanId = keyof typeof PLANS;

type ProfileCompletionFields = {
  name: string;
  age: number;
  location: string;
  profession: string;
  education: string;
  bio: string | null;
  phone: string | null;
  height: string | null;
  gotra: string | null;
  image_url: string;
  gallery_urls?: string[] | null;
};

type ProfileEntitlementRow = ProfileCompletionFields & {
  id: string;
  is_premium: boolean | null;
  premium_expires_at: string | null;
  premium_plan: string | null;
  free_chat_partner_id: string | null;
};

export type Entitlements = {
  isPremium: boolean;
  premiumExpiresAt: string | null;
  premiumPlan: PremiumPlanId | null;
  profileCompletionPercent: number;
  discoverable: boolean;
  savedCount: number;
  savedLimit: number | null;
  savedRemaining: number | null;
  interestsSentThisMonth: number;
  interestsLimit: number | null;
  interestsRemaining: number | null;
  freeChatAvailable: boolean;
  freeChatPartnerId: string | null;
  canUseKundli: boolean;
  canUseCompatibility: boolean;
  canSeeContact: boolean;
  canSeeProfileVisitors: boolean;
  canChat: boolean;
};

export function profileCompletionPercent(row: ProfileCompletionFields): number {
  return Math.round((profileCompletionChecks(row).filter(Boolean).length / 9) * 100);
}

function profileCompletionChecks(row: ProfileCompletionFields): boolean[] {
  return [
    !!(row.name?.trim() && row.name !== 'Member'),
    !!row.location?.trim(),
    !!row.profession?.trim(),
    !!row.education?.trim(),
    !!row.bio?.trim(),
    !!(row.phone && row.phone.replace(/\D/g, '').length >= 10),
    !!row.height?.trim(),
    !!row.gotra?.trim(),
    !!((row.gallery_urls?.length ?? 0) > 0 || !!row.image_url?.trim()),
  ];
}

export function isProfileDiscoverable(row: ProfileCompletionFields): boolean {
  const filled = profileCompletionChecks(row).filter(Boolean).length;
  return filled >= LIMITS.DISCOVER_MIN_FIELDS;
}

export function resolveIsPremium(row: {
  is_premium?: boolean | null;
  premium_expires_at?: string | null;
}): boolean {
  const exp = row.premium_expires_at;
  if (exp && new Date(exp).getTime() > Date.now()) return true;
  if (exp && new Date(exp).getTime() <= Date.now()) return false;
  return Boolean(row.is_premium);
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

const PROFILE_ENTITLEMENT_SELECT =
  'id, name, age, location, profession, education, bio, phone, height, gotra, image_url, gallery_urls, is_premium, premium_expires_at, premium_plan, free_chat_partner_id';

const PROFILE_ENTITLEMENT_SELECT_LEGACY =
  'id, name, age, location, profession, education, bio, phone, height, gotra, image_url, gallery_urls, is_premium';

export async function loadProfileEntitlementRow(
  sb: SupabaseAdmin,
  profileId: string
): Promise<ProfileEntitlementRow | null> {
  const { data: fullData, error: fullError } = await sb
    .from('profiles')
    .select(PROFILE_ENTITLEMENT_SELECT)
    .eq('id', profileId)
    .maybeSingle();

  let row: Record<string, unknown> | null = fullData as Record<string, unknown> | null;

  if (fullError && /column|does not exist|42703/i.test(fullError.message)) {
    const { data: legacyData, error: legacyError } = await sb
      .from('profiles')
      .select(PROFILE_ENTITLEMENT_SELECT_LEGACY)
      .eq('id', profileId)
      .maybeSingle();
    if (legacyError || !legacyData) return null;
    row = legacyData as Record<string, unknown>;
  } else if (fullError || !row) {
    return null;
  }

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    age: Number(row.age ?? 0),
    location: String(row.location ?? ''),
    profession: String(row.profession ?? ''),
    education: String(row.education ?? ''),
    bio: (row.bio as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    height: (row.height as string | null) ?? null,
    gotra: (row.gotra as string | null) ?? null,
    image_url: String(row.image_url ?? ''),
    gallery_urls: (row.gallery_urls as string[] | null) ?? null,
    is_premium: (row.is_premium as boolean | null) ?? null,
    premium_expires_at: (row.premium_expires_at as string | null) ?? null,
    premium_plan: (row.premium_plan as string | null) ?? null,
    free_chat_partner_id: (row.free_chat_partner_id as string | null) ?? null,
  };
}

export async function buildEntitlements(
  sb: SupabaseAdmin,
  profileId: string,
  row?: ProfileEntitlementRow | null
): Promise<Entitlements> {
  const profile = row ?? (await loadProfileEntitlementRow(sb, profileId));
  if (!profile) {
    return {
      isPremium: false,
      premiumExpiresAt: null,
      premiumPlan: null,
      profileCompletionPercent: 0,
      discoverable: false,
      savedCount: 0,
      savedLimit: LIMITS.FREE_SAVED,
      savedRemaining: LIMITS.FREE_SAVED,
      interestsSentThisMonth: 0,
      interestsLimit: LIMITS.FREE_INTERESTS_PER_MONTH,
      interestsRemaining: LIMITS.FREE_INTERESTS_PER_MONTH,
      freeChatAvailable: true,
      freeChatPartnerId: null,
      canUseKundli: false,
      canUseCompatibility: false,
      canSeeContact: false,
      canSeeProfileVisitors: false,
      canChat: false,
    };
  }

  const isPremium = resolveIsPremium(profile);
  const completion = profileCompletionPercent(profile);

  const [{ count: savedCount }, { count: interestCount }] = await Promise.all([
    sb
      .from('saved_interests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profileId),
    sb
      .from('interest_requests')
      .select('id', { count: 'exact', head: true })
      .eq('from_user_id', profileId)
      .gte('created_at', monthStartIso()),
  ]);

  const saved = savedCount ?? 0;
  const interests = interestCount ?? 0;

  const planRaw = profile.premium_plan;
  const premiumPlan =
    planRaw === 'monthly' || planRaw === '6months' || planRaw === '12months' ? planRaw : null;

  return {
    isPremium,
    premiumExpiresAt: profile.premium_expires_at,
    premiumPlan,
    profileCompletionPercent: completion,
    discoverable: isProfileDiscoverable(profile),
    savedCount: saved,
    savedLimit: isPremium ? null : LIMITS.FREE_SAVED,
    savedRemaining: isPremium ? null : Math.max(0, LIMITS.FREE_SAVED - saved),
    interestsSentThisMonth: interests,
    interestsLimit: isPremium ? null : LIMITS.FREE_INTERESTS_PER_MONTH,
    interestsRemaining: isPremium ? null : Math.max(0, LIMITS.FREE_INTERESTS_PER_MONTH - interests),
    freeChatAvailable: false,
    freeChatPartnerId: null,
    canUseKundli: isPremium,
    canUseCompatibility: isPremium,
    canSeeContact: isPremium,
    canSeeProfileVisitors: isPremium,
    canChat: isPremium,
  };
}

export async function hasAcceptedInterest(
  sb: SupabaseAdmin,
  profileA: string,
  profileB: string
): Promise<boolean> {
  const { data } = await sb
    .from('interest_requests')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(from_user_id.eq.${profileA},to_user_id.eq.${profileB}),and(from_user_id.eq.${profileB},to_user_id.eq.${profileA})`
    )
    .maybeSingle();
  return Boolean(data);
}

export type ChatAccessResult =
  | { allowed: true }
  | { allowed: false; status: number; error: string; code: string };

export async function checkChatAccess(
  sb: SupabaseAdmin,
  meId: string,
  partnerId: string
): Promise<ChatAccessResult> {
  if (meId === partnerId) {
    return { allowed: false, status: 400, error: 'Invalid chat partner', code: 'INVALID_PARTNER' };
  }

  const accepted = await hasAcceptedInterest(sb, meId, partnerId);
  if (!accepted) {
    return {
      allowed: false,
      status: 403,
      error: 'Chat opens after interest is accepted by both sides.',
      code: 'INTEREST_NOT_ACCEPTED',
    };
  }

  const row = await loadProfileEntitlementRow(sb, meId);
  if (!row) {
    return { allowed: false, status: 404, error: 'Profile not found', code: 'NOT_FOUND' };
  }

  if (!resolveIsPremium(row)) {
    return {
      allowed: false,
      status: 402,
      error: 'Chat is a Premium feature. Upgrade to message after mutual interest.',
      code: 'PREMIUM_REQUIRED',
    };
  }

  return { allowed: true };
}

/** Must stay in sync with LIST_PROFILE_SELECT in mappers.ts (+ phone, gallery_urls for completion %). */
export const DISCOVER_FILTER_SELECT =
  'id, name, age, gender, location, profession, education, image_url, is_verified, is_premium, height, income, gotra, bio, phone, gallery_urls';

export function filterDiscoverableRows<T extends ProfileCompletionFields>(rows: T[]): T[] {
  return rows.filter((r) => isProfileDiscoverable(r));
}

export async function activateSubscription(
  sb: SupabaseAdmin,
  profileId: string,
  plan: PremiumPlanId
): Promise<{ expiresAt: string; plan: PremiumPlanId }> {
  const spec = PLANS[plan];
  if (!spec) throw new Error('Invalid plan');

  const row = await loadProfileEntitlementRow(sb, profileId);
  const now = Date.now();
  const currentExp = row?.premium_expires_at ? new Date(row.premium_expires_at).getTime() : 0;
  const base = currentExp > now ? currentExp : now;
  const expiresAt = new Date(base + spec.days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await sb
    .from('profiles')
    .update({
      is_premium: true,
      premium_expires_at: expiresAt,
      premium_plan: plan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId);

  if (error) throw new Error(error.message);
  return { expiresAt, plan };
}
