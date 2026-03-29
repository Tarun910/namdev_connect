import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Message } from '../types';

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  if (!browserClient) {
    browserClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return browserClient;
}

/** Same naming as backend `chatRealtime.chatChannelTopic` — both clients must match. */
export function chatChannelTopic(profileIdA: string, profileIdB: string): string {
  return profileIdA < profileIdB ? `chat:${profileIdA}:${profileIdB}` : `chat:${profileIdB}:${profileIdA}`;
}

export type ChatBroadcastPayload = {
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

function profileIdNorm(id: string): string {
  return id.trim().toLowerCase();
}

export function broadcastPayloadToMessage(row: ChatBroadcastPayload, meId: string): Message {
  const d = new Date(row.created_at);
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    text: row.body,
    timestamp: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isMe: profileIdNorm(row.sender_id) === profileIdNorm(meId),
    readAt: row.read_at ?? null,
  };
}

export type ChatChannelHandlers = {
  onMessage: (msg: Message) => void;
  /** Fires when the other person opened the thread — refetch messages for tick updates. */
  onMessagesRead?: (payload: MessagesReadBroadcastPayload) => void;
};

export function subscribeToChatChannel(
  client: SupabaseClient,
  meId: string,
  partnerId: string,
  handlers: ChatChannelHandlers
): RealtimeChannel {
  const topic = chatChannelTopic(meId, partnerId);
  return client
    .channel(topic)
    .on('broadcast', { event: 'new_message' }, (payload: unknown) => {
      const p = payload as { payload?: ChatBroadcastPayload };
      const row = p?.payload ?? (payload as ChatBroadcastPayload);
      if (
        !row?.id ||
        !row.sender_id ||
        !row.receiver_id ||
        row.body === undefined ||
        !row.created_at
      ) {
        return;
      }
      const pair = new Set([profileIdNorm(row.sender_id), profileIdNorm(row.receiver_id)]);
      if (!pair.has(profileIdNorm(meId)) || !pair.has(profileIdNorm(partnerId))) return;
      handlers.onMessage(broadcastPayloadToMessage(row, meId));
    })
    .on('broadcast', { event: 'messages_read' }, (payload: unknown) => {
      const p = payload as { payload?: MessagesReadBroadcastPayload };
      const data = p?.payload ?? (payload as MessagesReadBroadcastPayload);
      if (!data?.reader_id) return;
      handlers.onMessagesRead?.(data);
    })
    .subscribe();
}
