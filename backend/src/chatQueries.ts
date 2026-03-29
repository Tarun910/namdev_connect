import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

/** Compare profile / message UUID strings from DB vs Clerk-derived ids (casing may differ). */
export function uuidKeysEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

type MessagePreviewRow = {
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
};

/** Inbox rows involving `me`, newest first (for thread list). Avoids brittle `.or()` filters on UUIDs. */
export async function fetchConversationPreviewRows(
  sb: SupabaseClient,
  me: string
): Promise<{ data: MessagePreviewRow[] | null; error: PostgrestError | null }> {
  const [asSender, asReceiver] = await Promise.all([
    sb
      .from('messages')
      .select('sender_id, receiver_id, body, created_at')
      .eq('sender_id', me)
      .order('created_at', { ascending: false })
      .limit(500),
    sb
      .from('messages')
      .select('sender_id, receiver_id, body, created_at')
      .eq('receiver_id', me)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  const err = asSender.error ?? asReceiver.error;
  if (err) return { data: null, error: err };
  const merged = [...(asSender.data ?? []), ...(asReceiver.data ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return { data: merged as MessagePreviewRow[], error: null };
}

/** Full message rows between two users, oldest first (for chat transcript). */
export async function fetchMessagesBetween(
  sb: SupabaseClient,
  me: string,
  partnerId: string
): Promise<{ data: unknown[] | null; error: PostgrestError | null }> {
  const [a, b] = await Promise.all([
    sb.from('messages').select('*').eq('sender_id', me).eq('receiver_id', partnerId),
    sb.from('messages').select('*').eq('sender_id', partnerId).eq('receiver_id', me),
  ]);
  const err = a.error ?? b.error;
  if (err) return { data: null, error: err };
  const merged = [...(a.data ?? []), ...(b.data ?? [])].sort(
    (x, y) =>
      new Date((x as { created_at: string }).created_at).getTime() -
      new Date((y as { created_at: string }).created_at).getTime()
  );
  return { data: merged, error: null };
}

/** Mark all messages from partner → me as read. Returns how many rows were updated. */
export async function markIncomingFromPartnerRead(
  sb: SupabaseClient,
  me: string,
  partnerId: string
): Promise<{ updated: number; error: PostgrestError | null }> {
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('messages')
    .update({ read_at: now })
    .eq('receiver_id', me)
    .eq('sender_id', partnerId)
    .is('read_at', null)
    .select('id');
  if (error) return { updated: 0, error };
  return { updated: data?.length ?? 0, error: null };
}
