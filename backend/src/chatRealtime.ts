import type { SupabaseClient } from '@supabase/supabase-js';

/** Stable topic for Supabase Realtime Broadcast (both participants derive the same string). */
export function chatChannelTopic(profileIdA: string, profileIdB: string): string {
  return profileIdA < profileIdB ? `chat:${profileIdA}:${profileIdB}` : `chat:${profileIdB}:${profileIdA}`;
}

export type ChatMessageBroadcastPayload = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
};

export type MessagesReadBroadcastPayload = {
  reader_id: string;
};

/**
 * Push a new message to subscribers. Uses HTTP when the channel is not subscribed (see Supabase Broadcast docs).
 */
export async function broadcastNewChatMessage(
  sb: SupabaseClient,
  participantA: string,
  participantB: string,
  row: ChatMessageBroadcastPayload
): Promise<void> {
  const topic = chatChannelTopic(participantA, participantB);
  const channel = sb.channel(topic);
  try {
    await channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: row,
    });
  } catch (err) {
    console.error('[chat realtime] broadcast failed:', err);
  }
}

/** Notify the other participant that incoming messages were marked read (for double ticks). */
export async function broadcastMessagesRead(
  sb: SupabaseClient,
  participantA: string,
  participantB: string,
  payload: MessagesReadBroadcastPayload
): Promise<void> {
  const topic = chatChannelTopic(participantA, participantB);
  const channel = sb.channel(topic);
  try {
    await channel.send({
      type: 'broadcast',
      event: 'messages_read',
      payload,
    });
  } catch (err) {
    console.error('[chat realtime] messages_read broadcast failed:', err);
  }
}
