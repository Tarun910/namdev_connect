import type { User } from '../types';

/** Same default as CompleteProfile cover — keep in sync. */
export const PROFILE_DEFAULT_PHOTO =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';

type PhotoSource = Pick<User, 'imageUrl' | 'galleryUrls'> | null | undefined;

/** Primary profile photo for avatars: gallery[0] → imageUrl → default. */
export function profilePhotoUrl(user: PhotoSource): string {
  const fromGallery = user?.galleryUrls?.find((u) => u?.trim());
  if (fromGallery) return fromGallery;
  const primary = user?.imageUrl?.trim();
  if (primary) return primary;
  return PROFILE_DEFAULT_PHOTO;
}
