import type { AppNotification, Message, Profile, User } from './types.js';

type ProfileRow = {
  id: string;
  clerk_user_id?: string | null;
  phone: string | null;
  email: string | null;
  name: string;
  age: number;
  gender: string | null;
  location: string;
  profession: string;
  education: string;
  image_url: string;
  is_verified: boolean;
  is_premium: boolean | null;
  height: string | null;
  income: string | null;
  bio: string | null;
  father_name: string | null;
  mother_name: string | null;
  gotra: string | null;
  birth_date: string | null;
  diet: string | null;
  smoke_alcohol: string | null;
  routine: string | null;
  interests: string[] | null;
  gallery_urls?: string[] | null;
};

export function rowToUser(row: ProfileRow): User {
  const gallery = row.gallery_urls?.filter((u) => u?.trim()) ?? [];
  return {
    id: row.id,
    phone: row.phone ?? '',
    email: row.email ?? undefined,
    name: row.name,
    age: row.age,
    gender: (row.gender as User['gender']) ?? undefined,
    location: row.location,
    profession: row.profession,
    education: row.education,
    imageUrl: row.image_url,
    galleryUrls: gallery.length ? gallery : undefined,
    isVerified: row.is_verified,
    isPremium: row.is_premium ?? undefined,
    height: row.height ?? undefined,
    income: row.income ?? undefined,
    bio: row.bio ?? undefined,
    fatherName: row.father_name ?? undefined,
    motherName: row.mother_name ?? undefined,
    gotra: row.gotra ?? undefined,
    birthDate: row.birth_date ?? undefined,
    diet: row.diet ?? undefined,
    smokeAlcohol: row.smoke_alcohol ?? undefined,
    routine: row.routine ?? undefined,
    interests: row.interests ?? undefined,
  };
}

export function rowToProfile(row: ProfileRow): Profile {
  const u = rowToUser(row);
  const { phone: _p, email: _e, ...rest } = u;
  return rest;
}

type MessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
};

export function rowToMessage(row: MessageRow, currentUserId: string): Message {
  const d = new Date(row.created_at);
  const timestamp = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    text: row.body,
    timestamp,
    isMe: row.sender_id === currentUserId,
  };
}

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  time_label: string | null;
  is_read: boolean;
  type: AppNotification['type'];
  created_at: string;
};

export function rowToNotification(row: NotificationRow): AppNotification {
  const fallback = new Date(row.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    time: row.time_label ?? fallback,
    isRead: row.is_read,
    type: row.type,
  };
}

const CAMEL_TO_SNAKE: Record<string, string> = {
  imageUrl: 'image_url',
  galleryUrls: 'gallery_urls',
  isPremium: 'is_premium',
  fatherName: 'father_name',
  motherName: 'mother_name',
  birthDate: 'birth_date',
  smokeAlcohol: 'smoke_alcohol',
};

const ALLOWED_PATCH_KEYS = new Set([
  'name',
  'age',
  'gender',
  'location',
  'profession',
  'education',
  'image_url',
  'is_premium',
  'height',
  'income',
  'bio',
  'father_name',
  'mother_name',
  'gotra',
  'birth_date',
  'diet',
  'smoke_alcohol',
  'routine',
  'interests',
  'phone',
  'email',
  'gallery_urls',
]);

export function patchBodyToRow(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    const snake = CAMEL_TO_SNAKE[key] ?? key;
    if (!ALLOWED_PATCH_KEYS.has(snake)) continue;
    if (snake === 'gallery_urls' && value !== undefined && value !== null && !Array.isArray(value)) {
      continue;
    }
    out[snake] = value;
  }
  out.updated_at = new Date().toISOString();
  return out;
}
