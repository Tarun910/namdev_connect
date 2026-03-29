import { clerkClient } from '@clerk/express';
import { getSupabaseAdmin } from './supabaseAdmin.js';

/** Default placeholder when no photo; must match CompleteProfile `DEFAULT_COVER` origin. */
export const PROFILE_DEFAULT_IMAGE_URL =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';

export function profileHasVerifiablePhoto(row: {
  image_url: string | null | undefined;
  gallery_urls?: string[] | null;
}): boolean {
  const img = (row.image_url ?? '').trim();
  if (img && img !== PROFILE_DEFAULT_IMAGE_URL) return true;
  const g = row.gallery_urls;
  if (Array.isArray(g) && g.some((u) => u && String(u).trim().length > 0)) return true;
  return false;
}

async function seedNotifications(profileId: string) {
  const sb = getSupabaseAdmin();
  await sb.from('notifications').insert([
    {
      user_id: profileId,
      title: 'Welcome!',
      body: 'Welcome to Namdev Connect. Start by completing your profile.',
      time_label: 'Just now',
      is_read: false,
      type: 'system',
    },
    {
      user_id: profileId,
      title: 'Interest Received',
      body: 'Someone in the community may reach out soon — complete your profile for better matches.',
      time_label: '2h ago',
      is_read: false,
      type: 'interest',
    },
    {
      user_id: profileId,
      title: 'Verify Profile',
      body: 'Get 3x more matches by verifying your profile.',
      time_label: '1d ago',
      is_read: true,
      type: 'verify',
    },
  ]);
}

export async function getOrCreateProfileId(clerkUserId: string): Promise<string> {
  const sb = getSupabaseAdmin();

  const { data: existing } = await sb
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  let email: string | null = null;
  let name = 'Member';
  let imageUrl = PROFILE_DEFAULT_IMAGE_URL;
  try {
    const u = await clerkClient.users.getUser(clerkUserId);
    email = u.emailAddresses[0]?.emailAddress ?? null;
    name =
      u.firstName ||
      u.username ||
      (email ? email.split('@')[0] : null) ||
      'Member';
    if (u.imageUrl) imageUrl = u.imageUrl;
  } catch {
    /* Clerk fetch optional */
  }

  const { data: inserted, error } = await sb
    .from('profiles')
    .insert({
      clerk_user_id: clerkUserId,
      name,
      email,
      phone: '',
      image_url: imageUrl,
      age: 25,
      location: '',
      profession: '',
      education: '',
    })
    .select('id')
    .single();

  if (error) {
    const { data: race } = await sb
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();
    if (race?.id) return race.id as string;
    throw error;
  }

  const id = inserted!.id as string;
  try {
    await seedNotifications(id);
  } catch (notifyErr) {
    console.error('[profiles] profile created but welcome notifications failed:', notifyErr);
  }
  return id;
}
