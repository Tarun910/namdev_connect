import React from 'react';
import type { User } from '../types';
import { profilePhotoUrl } from '../services/profilePhoto';

type Props = {
  user: Pick<User, 'imageUrl' | 'galleryUrls'> | null;
  onClick?: () => void;
  sizeClass?: string;
  className?: string;
  'aria-label'?: string;
};

const ProfileAvatarButton: React.FC<Props> = ({
  user,
  onClick,
  sizeClass = 'size-9',
  className = '',
  'aria-label': ariaLabel = 'Profile',
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    className={`${sizeClass} rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 border border-gray-100 dark:border-gray-700 shadow-sm active:scale-90 transition-transform shrink-0 ${className}`}
  >
    <img src={profilePhotoUrl(user)} alt="" className="w-full h-full object-cover" />
  </button>
);

export default ProfileAvatarButton;
