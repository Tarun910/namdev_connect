
export interface Profile {
  id: string;
  /** Present on GET /profile/:id when authenticated — whether you saved this profile. */
  isSaved?: boolean;
  name: string;
  age: number;
  gender?: 'Male' | 'Female';
  location: string;
  profession: string;
  education: string;
  imageUrl: string;
  /** Extra photos; cover / discover card uses imageUrl (first gallery slot on save). */
  galleryUrls?: string[];
  isVerified: boolean;
  isPremium?: boolean;
  height?: string;
  income?: string;
  bio?: string;
  fatherName?: string;
  motherName?: string;
  gotra?: string;
  birthDate?: string; // Format: DD MMM YYYY
  // Lifestyle fields
  diet?: string;
  smokeAlcohol?: string;
  routine?: string;
  interests?: string[];
}

export type Language = 'en' | 'hi';

export interface User extends Profile {
  phone: string;
  email?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  isMe: boolean;
  /** When isMe: set after the other person opens this thread (read receipt). */
  readAt?: string | null;
}

export interface Conversation {
  id: string;
  partner: Profile;
  lastMessage: string;
  time: string;
  unreadCount: number;
  online?: boolean;
}

/** From GET /api/chat/conversations */
export interface ChatThreadPreview {
  partner: Profile;
  lastMessage: string;
  time: string;
  unreadCount?: number;
}

/** Pending interest received by the current user (accept/reject in Notifications). */
export interface IncomingInterestRequest {
  id: string;
  createdAt: string;
  fromProfile: Profile;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  isRead: boolean;
  type: 'interest' | 'message' | 'system' | 'verify';
}
