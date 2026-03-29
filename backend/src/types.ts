export interface Profile {
  id: string;
  isSaved?: boolean;
  name: string;
  age: number;
  gender?: 'Male' | 'Female';
  location: string;
  profession: string;
  education: string;
  imageUrl: string;
  /** Additional photos; cover is always imageUrl (app sets imageUrl from gallery[0] on save). */
  galleryUrls?: string[];
  isVerified: boolean;
  isPremium?: boolean;
  height?: string;
  income?: string;
  bio?: string;
  fatherName?: string;
  motherName?: string;
  gotra?: string;
  birthDate?: string;
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
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  isRead: boolean;
  type: 'interest' | 'message' | 'system' | 'verify';
}

export interface AppState {
  user: User;
  profiles: Profile[];
  messages: Message[];
  notifications: AppNotification[];
  sessionToken: string | null;
}
