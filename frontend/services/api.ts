import type { AppNotification, Message, PremiumPlanId, Profile, User } from '../types';
import { clerkSignOut, getClerkSessionToken } from './clerk-session';
import { fetchWithCache, invalidateApiCache } from './apiCache';

export { invalidateApiCache };

async function getAccessToken(): Promise<string | null> {
  return getClerkSessionToken();
}

function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
  return raw ?? '';
}

function networkErrorMessage(cause: unknown, url: string): string {
  const base = apiBaseUrl() || '(same origin /api)';
  if (cause instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(cause.message)) {
    return `Cannot reach the API (${base}). On Vercel set VITE_API_BASE_URL to your Render URL (no /api suffix). Details: ${cause.message}`;
  }
  return cause instanceof Error ? cause.message : 'Request failed';
}

function parseApiErrorBody(text: string, statusText: string, status: number): ApiError {
  if (!text) return new ApiError(statusText || 'Request failed', status);
  if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
    return new ApiError(
      'API returned HTML instead of JSON. On Vercel set VITE_API_BASE_URL=https://namdev-connect-api.onrender.com and redeploy.',
      status
    );
  }
  try {
    const data = JSON.parse(text) as { error?: string; code?: string };
    const msg = typeof data.error === 'string' ? data.error : statusText || 'Request failed';
    return new ApiError(msg, status, typeof data.code === 'string' ? data.code : undefined);
  } catch {
    return new ApiError(text.length > 200 ? `${text.slice(0, 200)}…` : text, status);
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
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
  if (!res.ok) {
    throw parseApiErrorBody(text, res.statusText, res.status);
  }
  if (!text) return null as T;
  if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
    throw parseApiErrorBody(text, res.statusText, res.status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw parseApiErrorBody(text, res.statusText, res.status);
  }
}

/** Use with `useAuth().getToken()` right after `isLoaded` to avoid a race with ClerkTokenBridge. */
export async function authorizedFetch<T>(path: string, bearerToken: string, init?: RequestInit): Promise<T> {
  if (init?.method && init.method !== 'GET') {
    invalidateApiCache('/profile/me');
  }
  return request<T>(path, init, bearerToken);
}

/** Cached GET for hot paths like `/profile/me` (45s TTL). */
export async function authorizedFetchCached<T>(
  path: string,
  bearerToken: string,
  ttlMs = 45_000
): Promise<T> {
  const key = `${path}:${bearerToken.slice(-12)}`;
  return fetchWithCache(key, () => authorizedFetch<T>(path, bearerToken), ttlMs);
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
    getContact: async (id: string): Promise<{ phone: string | null; email: string | null }> =>
      request(`/profile/${encodeURIComponent(id)}/contact`),
    getAll: async (): Promise<Profile[]> => request('/profiles'),
    getFeatured: async (limit = 8): Promise<Profile[]> =>
      request(`/profiles/featured?limit=${limit}`),
  },
  membership: {
    subscribe: async (plan: PremiumPlanId) =>
      request<{ ok: boolean; expiresAt: string; plan: PremiumPlanId }>('/membership/subscribe', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      }),
    checkKundli: async (partnerId: string) =>
      request<{ ok: boolean }>(`/premium/kundli/${encodeURIComponent(partnerId)}`),
    checkCompatibility: async (partnerId: string) =>
      request<{ ok: boolean }>(`/premium/compatibility/${encodeURIComponent(partnerId)}`),
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
