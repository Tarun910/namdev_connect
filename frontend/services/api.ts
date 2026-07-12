import type { AppNotification, Message, Profile, User } from '../types';
import { clerkSignOut, getClerkSessionToken } from './clerk-session';

async function getAccessToken(): Promise<string | null> {
  return getClerkSessionToken();
}

function apiBaseUrl(): string {
  // Production: same-origin /api (Vercel rewrites → Railway). Local dev: Vite proxy → localhost:5000.
  if (import.meta.env.PROD) return '';
  const raw = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
  return raw ?? '';
}

function networkErrorMessage(cause: unknown, url: string): string {
  const base = apiBaseUrl() || '(same origin /api)';
  if (cause instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(cause.message)) {
    return `Cannot reach the API (${base}). If you use Vercel, redeploy the Railway backend and confirm /api/health works. Details: ${cause.message}`;
  }
  return cause instanceof Error ? cause.message : 'Request failed';
}

async function request<T>(path: string, init?: RequestInit, bearerToken?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  const token = bearerToken !== undefined ? bearerToken : await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const prefix = apiBaseUrl() ? `${apiBaseUrl()}/api` : '/api';
  const url = `${prefix}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    throw new Error(networkErrorMessage(e, url));
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || res.statusText };
  }

  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? res.statusText;
    throw new Error(typeof msg === 'string' ? msg : 'Request failed');
  }
  return data as T;
}

/** Use with `useAuth().getToken()` right after `isLoaded` to avoid a race with ClerkTokenBridge. */
export async function authorizedFetch<T>(path: string, bearerToken: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init, bearerToken);
}

export const api = {
  auth: {
    logout: async () => {
      await clerkSignOut();
    },
    getSession: async (): Promise<{ token: string; user: User } | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      try {
        const user = await request<User>('/profile/me', undefined, token);
        return { token, user };
      } catch {
        return null;
      }
    },
  },
  profile: {
    getMe: async (): Promise<User> => request('/profile/me'),
    update: async (data: Partial<User>): Promise<User> =>
      request('/profile/me', { method: 'PATCH', body: JSON.stringify(data) }),
    getById: async (id: string): Promise<Profile | undefined> => {
      try {
        return await request<Profile>(`/profile/${encodeURIComponent(id)}`);
      } catch {
        return undefined;
      }
    },
    getAll: async (): Promise<Profile[]> => request('/profiles'),
  },
  chat: {
    getMessages: async (partnerId: string): Promise<Message[]> =>
      request(`/chat/${encodeURIComponent(partnerId)}/messages`),
    sendMessage: async (receiverId: string, text: string): Promise<Message> =>
      request('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ receiverId, text }),
      }),
  },
  notifications: {
    getAll: async (): Promise<AppNotification[]> => request('/notifications'),
    markAllRead: async () => {
      await request('/notifications/mark-read', { method: 'POST', body: JSON.stringify({}) });
    },
  },
};
