import { LIST_PROFILE_SELECT, rowToProfileCard } from './mappers.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

const VIEWER_NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const BLURRED_VISITOR_AVATAR =
  'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=200&h=200&fit=crop&blur=10';

export function blurVisitorName(name: string): string {
  const first = (name.trim().split(/\s+/)[0] || 'Someone').replace(/[^\p{L}\p{N}]/gu, '');
  if (!first) return '••••';
  if (first.length === 1) return `${first}•••`;
  return `${first[0]}${'•'.repeat(Math.min(first.length - 1, 5))}`;
}

type ViewerRow = Parameters<typeof rowToProfileCard>[0];

/** Record a profile view and notify the owner (at most once per viewer per 24h). */
export async function recordProfileView(
  sb: SupabaseAdmin,
  viewerId: string,
  viewedId: string
): Promise<void> {
  if (viewerId === viewedId) return;

  await sb.from('profile_views').insert({
    viewer_id: viewerId,
    viewed_id: viewedId,
  });

  const since = new Date(Date.now() - VIEWER_NOTIFY_COOLDOWN_MS).toISOString();
  const { data: recentNotify } = await sb
    .from('notifications')
    .select('id')
    .eq('user_id', viewedId)
    .eq('type', 'profile_view')
    .eq('viewer_profile_id', viewerId)
    .gte('created_at', since)
    .maybeSingle();

  if (recentNotify) return;

  const { data: viewerRow } = await sb
    .from('profiles')
    .select('name')
    .eq('id', viewerId)
    .maybeSingle();

  const displayName = (viewerRow as { name?: string } | null)?.name?.trim() || 'Someone';
  const firstName = displayName.split(/\s+/)[0] || 'Someone';

  await sb.from('notifications').insert({
    user_id: viewedId,
    viewer_profile_id: viewerId,
    title: 'Profile visit',
    body: `${firstName} viewed your profile`,
    time_label: 'Just now',
    is_read: false,
    type: 'profile_view',
  });
}

export type NotificationViewerPreview = {
  id?: string;
  name: string;
  imageUrl: string;
  age?: number;
  location?: string;
  profession?: string;
  blurred: boolean;
};

export function viewerPreviewFromRow(
  row: ViewerRow,
  isPremium: boolean
): NotificationViewerPreview {
  const card = rowToProfileCard(row);
  if (isPremium) {
    return {
      id: card.id,
      name: card.name,
      imageUrl: card.imageUrl,
      age: card.age,
      location: card.location,
      profession: card.profession,
      blurred: false,
    };
  }
  return {
    name: blurVisitorName(card.name),
    imageUrl: BLURRED_VISITOR_AVATAR,
    blurred: true,
  };
}

export async function loadViewerRowsById(
  sb: SupabaseAdmin,
  ids: string[]
): Promise<Map<string, ViewerRow>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await sb.from('profiles').select(LIST_PROFILE_SELECT).in('id', unique);
  const map = new Map<string, ViewerRow>();
  for (const row of data ?? []) {
    map.set((row as ViewerRow).id, row as ViewerRow);
  }
  return map;
}
