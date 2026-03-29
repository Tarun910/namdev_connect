import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { authorizedFetch } from '../services/api';
import { User } from '../types';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';

/** Stored as text in Postgres / JSON — keep each data URL under this after compression. */
const MAX_IMAGE_DATA_URL_CHARS = 900_000;
const MAX_PROFILE_PHOTOS = 7;
const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

/** Shrink camera photos so they fit in the DB and actually show up in the UI. */
async function imageFileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return readFileAsDataURL(file);
  }

  const bitmap = typeof createImageBitmap === 'function' ? await tryCreateImageBitmap(file) : null;
  const img = bitmap ? null : await loadHtmlImage(file);
  try {
    let width = bitmap ? bitmap.width : (img as HTMLImageElement).naturalWidth;
    let height = bitmap ? bitmap.height : (img as HTMLImageElement).naturalHeight;
    if (!width || !height) {
      return readFileAsDataURL(file);
    }

    let maxDim = 1600;
    let quality = 0.82;
    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = document.createElement('canvas');
      let w = width;
      let h = height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return readFileAsDataURL(file);
      if (bitmap) {
        ctx.drawImage(bitmap, 0, 0, w, h);
      } else {
        ctx.drawImage(img as HTMLImageElement, 0, 0, w, h);
      }
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_IMAGE_DATA_URL_CHARS) {
        return dataUrl;
      }
      maxDim = Math.round(maxDim * 0.75);
      quality -= 0.1;
    }
    return readFileAsDataURL(file);
  } finally {
    bitmap?.close();
  }
}

function tryCreateImageBitmap(file: File): Promise<ImageBitmap | null> {
  return createImageBitmap(file).catch(() => null);
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    image.src = url;
  });
}

const CompleteProfile: React.FC = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language, setLanguage } = useContext(LanguageContext);
  const t = useTranslation(language);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [photoAddMessage, setPhotoAddMessage] = useState<string | null>(null);
  const [photoAdding, setPhotoAdding] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoadError(null);
    setInitialLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setLoadError('No session token. Try signing in again.');
        return;
      }
      const user = await authorizedFetch<User>('/profile/me', token);
      const fromGallery = user.galleryUrls?.filter((u) => u?.trim()) ?? [];
      const primary = user.imageUrl?.trim();
      let photos =
        fromGallery.length > 0 ? fromGallery : primary ? [primary] : [];
      if (photos.length > MAX_PROFILE_PHOTOS) {
        photos = photos.slice(0, MAX_PROFILE_PHOTOS);
      }
      setGalleryPhotos(photos);
      setActivePhotoIdx(0);
      setFormData(user);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load profile');
    } finally {
      setInitialLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/login');
      return;
    }
    void loadProfile();
  }, [isLoaded, isSignedIn, navigate, loadProfile]);

  const handleGalleryChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const fileList = input.files;
    if (!fileList?.length) return;

    const filesArr = Array.from(fileList) as File[];
    setPhotoAdding(true);
    setPhotoAddMessage(null);
    setSaveError(null);

    const room = MAX_PROFILE_PHOTOS - galleryPhotos.length;
    if (room <= 0) {
      setPhotoAddMessage(
        `You can't upload more than ${MAX_PROFILE_PHOTOS} photos. Remove one to add another.`
      );
      setPhotoAdding(false);
      input.value = '';
      return;
    }

    const additions: string[] = [];
    let skipped = 0;
    const cappedFiles = filesArr.slice(0, room);
    const droppedExtra = filesArr.length > room;

    try {
      const startLen = galleryPhotos.length;
      for (const file of cappedFiles) {
        if (startLen + additions.length >= MAX_PROFILE_PHOTOS) break;
        try {
          const dataUrl = await imageFileToCompressedDataUrl(file);
          if (dataUrl.startsWith('data:') && dataUrl.length > MAX_IMAGE_DATA_URL_CHARS) {
            skipped++;
            continue;
          }
          additions.push(dataUrl);
        } catch {
          skipped++;
        }
      }

      if (additions.length > 0) {
        setGalleryPhotos((prev) => [...prev, ...additions]);
        const parts = [`Added ${additions.length} photo(s).`];
        if (droppedExtra) {
          parts.push(`Max ${MAX_PROFILE_PHOTOS} photos allowed — extra files were not added.`);
        }
        if (skipped > 0) {
          parts.push(`${skipped} file(s) could not be processed.`);
        }
        setPhotoAddMessage(parts.join(' '));
      } else if (skipped > 0) {
        setPhotoAddMessage(
          `Could not use ${skipped} file(s). Try JPG or PNG from Gallery (some RAW/HEIC formats are not supported in the browser).`
        );
      } else if (droppedExtra) {
        setPhotoAddMessage(
          `You can't upload more than ${MAX_PROFILE_PHOTOS} photos. Remove one to add another.`
        );
      }
    } finally {
      setPhotoAdding(false);
      input.value = '';
    }
  };

  const removeGalleryPhoto = (index: number) => {
    setGalleryPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setActivePhotoIdx((idx) => Math.min(idx, Math.max(0, next.length - 1)));
      return next;
    });
  };

  const makeCoverPhoto = (index: number) => {
    if (index <= 0) return;
    setGalleryPhotos((prev) => {
      const next = [...prev];
      const [picked] = next.splice(index, 1);
      next.unshift(picked);
      return next;
    });
    setActivePhotoIdx(0);
  };

  const buildPatch = (): Partial<User> => {
    const cover =
      galleryPhotos[0]?.trim() || formData.imageUrl?.trim() || DEFAULT_COVER;
    return {
      ...formData,
      imageUrl: cover,
      galleryUrls: [...galleryPhotos],
    };
  };

  const persistProfile = async (): Promise<User> => {
    const token = await getToken();
    if (!token) throw new Error('No session token. Try signing in again.');
    const patch = buildPatch();
    for (const url of [patch.imageUrl, ...(patch.galleryUrls ?? [])]) {
      if (
        typeof url === 'string' &&
        url.startsWith('data:') &&
        url.length > MAX_IMAGE_DATA_URL_CHARS
      ) {
        throw new Error('One or more photos are too large. Remove them or use smaller images.');
      }
    }
    return authorizedFetch<User>('/profile/me', token, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  };

  const handleSave = async () => {
    setSaveError(null);
    setLoading(true);
    try {
      await persistProfile();
      navigate('/dashboard');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    setSaveError(null);
    setLoading(true);
    try {
      const updatedUser = await persistProfile();
      if (updatedUser.id) {
        navigate(`/profile/${updatedUser.id}`);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const { clerkSignOut } = await import('../services/clerk-session');
    await clerkSignOut();
    navigate('/login');
  };

  const triggerUpload = () => {
    if (galleryPhotos.length >= MAX_PROFILE_PHOTOS) {
      setPhotoAddMessage(
        `You can't upload more than ${MAX_PROFILE_PHOTOS} photos. Remove one to add another.`
      );
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFieldChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleInterestToggle = (interest: string) => {
    const currentInterests = formData.interests || [];
    if (currentInterests.includes(interest)) {
      handleFieldChange(
        'interests',
        currentInterests.filter((i) => i !== interest)
      );
    } else {
      handleFieldChange('interests', [...currentInterests, interest]);
    }
  };

  const fieldsToCheck = [
    { key: 'name', label: 'Full Name' },
    { key: 'age', label: 'Age' },
    { key: 'location', label: 'Location' },
    { key: 'profession', label: 'Profession' },
    { key: 'education', label: 'Education' },
    { key: 'bio', label: 'Bio / About' },
    { key: 'imageUrl', label: 'Profile photos (at least one)' },
    { key: 'diet', label: 'Dietary Habits' },
    { key: 'smokeAlcohol', label: 'Smoking & Alcohol' },
    { key: 'routine', label: 'Daily Routine' },
  ];

  const filledFields = fieldsToCheck.filter((f) => {
    if (f.key === 'imageUrl') return galleryPhotos.length > 0;
    const val = (formData as Record<string, unknown>)[f.key];
    return val !== undefined && val !== null && val !== '';
  });

  const missingFields = fieldsToCheck.filter((f) => {
    if (f.key === 'imageUrl') return galleryPhotos.length === 0;
    const val = (formData as Record<string, unknown>)[f.key];
    return !val;
  });

  const completeness = Math.round((filledFields.length / fieldsToCheck.length) * 100);

  const interestOptions = [
    'Vegetarian',
    'Traditional Values',
    'Yoga',
    'Travel',
    'Community Service',
    'Cooking',
    'Reading',
    'Music',
    'Sports',
    'Photography',
    'Art',
  ];

  if (!isLoaded || initialLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark px-6">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Loading profile…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark px-6 text-center">
        <span className="material-symbols-outlined text-5xl text-amber-500 mb-3">cloud_off</span>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 max-w-sm">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadProfile()}
          className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark animate-fade-up font-body">
      <header className="sticky top-0 z-50 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md flex items-center px-4 py-4 justify-between border-b border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-10 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined text-primary">arrow_back</span>
        </button>
        <h2 className="text-[#191011] dark:text-white text-lg font-bold font-poppins">{t('settings')}</h2>
        <div className="size-10"></div>
      </header>

      <main className="flex-1 px-6 pt-6 pb-96 space-y-8">
        {saveError && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200">
            {saveError}
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          Changes are saved to your Supabase database when you tap Update profile or Preview.
        </p>

        <section className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">translate</span>
            <p className="text-xs font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500">
              {t('language')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`py-3 rounded-2xl font-bold transition-all ${language === 'en' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-50 dark:bg-white/5 text-gray-500'}`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('hi')}
              className={`py-3 rounded-2xl font-bold transition-all ${language === 'hi' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-50 dark:bg-white/5 text-gray-500'}`}
            >
              हिंदी
            </button>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-saffron text-[10px] font-black tracking-[0.2em] uppercase mb-1">Completeness</span>
              <p className="text-[#191011] dark:text-gray-100 text-2xl font-black leading-tight">
                {completeness}% Complete
              </p>
            </div>
          </div>
          <div className="rounded-full bg-primary/10 dark:bg-white/10 h-3 w-full overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${completeness}%` }}
            />
          </div>

          {missingFields.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/10 border border-saffron/20 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-300">
              <p className="text-[10px] font-black text-saffron uppercase tracking-widest mb-2">Next Steps for 100%:</p>
              <ul className="space-y-1.5">
                {missingFields.slice(0, 3).map((f) => (
                  <li
                    key={f.key}
                    className="flex items-center gap-2 text-xs font-bold text-[#191011]/70 dark:text-gray-400"
                  >
                    <span className="material-symbols-outlined text-saffron text-[14px]">add_circle</span>
                    Add {f.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500">
              <span className="material-symbols-outlined text-[16px]">photo_library</span>
              Profile photos
            </label>
            <span className="text-[10px] font-bold text-gray-400">
              {galleryPhotos.length}/{MAX_PROFILE_PHOTOS} · first = cover
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2 px-1">
            Add several images. The first is your main photo in Discover. Tap “Cover” on any thumbnail to move it to the front.
          </p>

          {photoAdding && (
            <div className="flex items-center gap-2 text-sm font-bold text-primary px-1" role="status">
              <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              Processing photos…
            </div>
          )}
          {photoAddMessage && (
            <p className="text-sm font-medium text-[#191011] dark:text-gray-200 bg-primary/5 dark:bg-primary/10 rounded-xl px-3 py-2 border border-primary/15">
              {photoAddMessage}
            </p>
          )}

          <div className="relative w-full aspect-[4/5] max-h-80 rounded-3xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-inner">
            {galleryPhotos.length > 0 ? (
              <>
                <img
                  src={galleryPhotos[Math.min(activePhotoIdx, galleryPhotos.length - 1)]}
                  alt="Selected"
                  className="w-full h-full object-cover"
                />
                {/* Delayed: verified badge on cover photo when photo verification ships
                {formData.isVerified && (
                  <div className="absolute bottom-3 right-3 size-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-900" title={t('verify_photo_done')}>
                    <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                )}
                */}
                {galleryPhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous photo"
                      className="absolute left-2 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-sm"
                      onClick={() =>
                        setActivePhotoIdx((i) =>
                          i <= 0 ? galleryPhotos.length - 1 : i - 1
                        )
                      }
                    >
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Next photo"
                      className="absolute right-2 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-sm"
                      onClick={() =>
                        setActivePhotoIdx((i) =>
                          i >= galleryPhotos.length - 1 ? 0 : i + 1
                        )
                      }
                    >
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                      {galleryPhotos.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Show photo ${i + 1}`}
                          className={`h-1.5 rounded-full transition-all ${i === activePhotoIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
                          onClick={() => setActivePhotoIdx(i)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={triggerUpload}
                className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400"
              >
                <span className="material-symbols-outlined text-5xl">add_photo_alternate</span>
                <span className="text-xs font-bold uppercase tracking-wide">Add photos</span>
              </button>
            )}
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {galleryPhotos.map((src, i) => (
              <div key={`${i}-${src.slice(0, 32)}`} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActivePhotoIdx(i);
                  }}
                  className={`size-20 rounded-2xl overflow-hidden border-2 ${i === activePhotoIdx ? 'border-primary ring-2 ring-primary/30' : 'border-gray-100 dark:border-gray-600'}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
                {i === 0 && (
                  <span className="absolute -top-1 -left-1 text-[9px] font-black bg-primary text-white px-1.5 py-0.5 rounded-md uppercase">
                    Cover
                  </span>
                )}
                <div className="absolute -bottom-1 left-0 right-0 flex justify-center gap-0.5">
                  {i > 0 && (
                    <button
                      type="button"
                      className="text-[9px] font-bold bg-white/95 dark:bg-gray-900/95 text-primary px-1 rounded shadow"
                      onClick={(e) => {
                        e.stopPropagation();
                        makeCoverPhoto(i);
                      }}
                    >
                      Cover
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="absolute -top-2 -right-2 size-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
                  aria-label="Remove photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeGalleryPhoto(i);
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ))}
            {galleryPhotos.length < MAX_PROFILE_PHOTOS && (
              <button
                type="button"
                onClick={triggerUpload}
                className="shrink-0 size-20 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center text-gray-400 gap-0.5"
              >
                <span className="material-symbols-outlined">add</span>
                <span className="text-[9px] font-bold uppercase">Add</span>
              </button>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => void handleGalleryChange(e)}
            accept="image/*"
            multiple
            className="hidden"
          />
        </section>

        {/*
        --- Photo verification UI (delayed; enable with POST /api/profile/verify-photo + AWS Rekognition) ---
        Full block was: emerald section with verified_user icon, selfie file input (capture="user"),
        handleVerificationSelfieChange, handleVerifyPhoto, verifyLoading / verifyError / verificationSelfieDataUrl state,
        verificationSelfieRef. Re-comment imports in backend/src/index.ts and uncomment rekognition routes.
        --- */}

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
            <span className="material-symbols-outlined text-[16px]">person</span>
            Full Name
          </label>
          <input
            type="text"
            className="w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-base shadow-sm outline-none font-bold"
            placeholder="Your full name"
            value={formData.name || ''}
            onChange={(e) => handleFieldChange('name', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
              Age
            </label>
            <input
              type="number"
              min={18}
              max={120}
              className="w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-base shadow-sm outline-none font-bold"
              placeholder="25"
              value={formData.age ?? ''}
              onChange={(e) =>
                handleFieldChange('age', e.target.value === '' ? undefined : Number(e.target.value))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
              Gender
            </label>
            <select
              className="w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-base shadow-sm outline-none font-bold"
              value={formData.gender || ''}
              onChange={(e) => handleFieldChange('gender', e.target.value || undefined)}
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
            <span className="material-symbols-outlined text-[16px]">location_on</span>
            Location
          </label>
          <input
            type="text"
            className="w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-base shadow-sm outline-none font-bold"
            placeholder="City, State"
            value={formData.location || ''}
            onChange={(e) => handleFieldChange('location', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
              Phone
            </label>
            <input
              type="tel"
              className="w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-base shadow-sm outline-none font-bold"
              placeholder="+91 …"
              value={formData.phone || ''}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-base shadow-sm outline-none font-bold"
              placeholder="you@example.com"
              value={formData.email || ''}
              onChange={(e) => handleFieldChange('email', e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
            <span className="material-symbols-outlined text-[16px]">format_quote</span>
            Bio / About Me
          </label>
          <textarea
            rows={3}
            className="w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-sm shadow-sm outline-none font-medium resize-none"
            placeholder="Tell us about yourself, your hobbies, and what you're looking for..."
            value={formData.bio || ''}
            onChange={(e) => handleFieldChange('bio', e.target.value)}
          />
        </div>

        <div className="space-y-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#191011]/30 dark:text-gray-600 px-1 pt-4">
            Personal & Professional
          </p>
          {[
            {
              id: 'height',
              label: 'Height',
              icon: 'straighten',
              options: [
                `5' 0" (152 cm)`,
                `5' 2" (157 cm)`,
                `5' 4" (162 cm)`,
                `5' 6" (167 cm)`,
                `5' 8" (172 cm)`,
                `5' 10" (177 cm)`,
                `6' 0" (182 cm)`,
              ],
            },
            {
              id: 'education',
              label: 'Education Level',
              icon: 'school',
              options: [
                'High School',
                "Bachelor's Degree",
                "Master's Degree",
                'Doctorate / PhD',
                'Chartered Accountant',
              ],
            },
            {
              id: 'profession',
              label: 'Profession',
              icon: 'work',
              options: [
                'Software Engineer',
                'Doctor / Healthcare',
                'Entrepreneur',
                'Chartered Accountant',
                'Teacher',
                'Other Professional',
              ],
            },
            {
              id: 'income',
              label: 'Annual Income',
              icon: 'payments',
              options: ['₹3L - ₹5L', '₹5L - ₹10L', '₹10L - ₹15L', '₹15L - ₹25L', '₹25L +'],
            },
          ].map((field) => (
            <div key={field.label} className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
                <span className="material-symbols-outlined text-[16px]">{field.icon}</span>
                {field.label}
              </label>
              <div className="relative">
                <select
                  className="flex w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-base shadow-sm outline-none appearance-none font-bold"
                  value={(formData as Record<string, string>)[field.id] || ''}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                >
                  <option disabled value="">
                    Select {field.label.toLowerCase()}
                  </option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#191011]/30 dark:text-gray-600 px-1">
            Family & details
          </p>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
              Gotra
            </label>
            <input
              type="text"
              className="w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-base shadow-sm outline-none font-bold"
              value={formData.gotra || ''}
              onChange={(e) => handleFieldChange('gotra', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
                Father&apos;s name
              </label>
              <input
                type="text"
                className="w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-base shadow-sm outline-none font-bold"
                value={formData.fatherName || ''}
                onChange={(e) => handleFieldChange('fatherName', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
                Mother&apos;s name
              </label>
              <input
                type="text"
                className="w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-base shadow-sm outline-none font-bold"
                value={formData.motherName || ''}
                onChange={(e) => handleFieldChange('motherName', e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
              Birth date
            </label>
            <input
              type="text"
              className="w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-base shadow-sm outline-none font-bold"
              placeholder="e.g. 15 Jan 1998"
              value={formData.birthDate || ''}
              onChange={(e) => handleFieldChange('birthDate', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#191011]/30 dark:text-gray-600 px-1 pt-4">
            Lifestyle Alignment
          </p>
          {[
            {
              id: 'diet',
              label: 'Dietary Habits',
              icon: 'nutrition',
              options: ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian'],
            },
            {
              id: 'smokeAlcohol',
              label: 'Smoking & Alcohol',
              icon: 'smoke_free',
              options: ['Non-smoker & Non-drinker', 'Social Drinker', 'Regular Drinker', 'Smoker'],
            },
            {
              id: 'routine',
              label: 'Daily Routine',
              icon: 'wb_sunny',
              options: ['Early Riser (5 AM - 6 AM)', 'Normal Routine', 'Night Owl', 'Flexible'],
            },
          ].map((field) => (
            <div key={field.label} className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
                <span className="material-symbols-outlined text-[16px]">{field.icon}</span>
                {field.label}
              </label>
              <div className="relative">
                <select
                  className="flex w-full rounded-2xl border-none bg-white dark:bg-white/5 py-4 px-4 text-[#191011] dark:text-white focus:ring-2 focus:ring-primary/10 text-base shadow-sm outline-none appearance-none font-bold"
                  value={(formData as Record<string, string>)[field.id] || ''}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                >
                  <option disabled value="">
                    Select {field.label.toLowerCase()}
                  </option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#191011]/50 dark:text-gray-500 px-1">
            <span className="material-symbols-outlined text-[16px]">interests</span>
            Common Interests
          </label>
          <div className="flex flex-wrap gap-2">
            {interestOptions.map((interest) => {
              const isSelected = (formData.interests || []).includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => handleInterestToggle(interest)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                      : 'bg-white dark:bg-white/5 text-gray-500 border-gray-100 dark:border-gray-700'
                  }`}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-8 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1 font-poppins">
            Account Actions
          </p>
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-between p-5 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="size-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600">
                <span className="material-symbols-outlined">logout</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-red-600 font-poppins">{t('logout')}</p>
                <p className="text-[10px] text-red-400 font-medium tracking-wide">
                  Clear session from this device
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-red-300">chevron_right</span>
          </button>
        </div>
      </main>

      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto bg-gradient-to-t from-background-light via-background-light dark:from-background-dark dark:via-background-dark p-6 pt-4 pb-6 z-50 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void handlePreview()}
          disabled={loading}
          className="w-full bg-white dark:bg-gray-800 border border-primary text-primary font-black py-4 rounded-2xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm font-poppins"
        >
          {t('preview_profile')}
          <span className="material-symbols-outlined text-lg">visibility</span>
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-70 uppercase tracking-widest text-sm font-poppins"
        >
          {loading ? (
            <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            t('update_profile')
          )}
          {!loading && <span className="material-symbols-outlined text-lg">check_circle</span>}
        </button>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px] flex items-center justify-center px-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-sm rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center transform animate-in zoom-in-95 duration-200">
            <div className="w-24 h-24 bg-primary/5 dark:bg-primary/10 rounded-full flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20 animate-[spin_10s_linear_infinite]" />
              <span className="material-symbols-outlined text-primary text-5xl">door_open</span>
            </div>
            <h1 className="font-poppins text-2xl font-bold text-[#191011] dark:text-white mb-2">{t('logout')}?</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-8 max-w-[240px]">
              {t('logout_confirm')} <br />
              <span className="font-semibold text-primary/80">{t('miss_you')}</span>
            </p>
            <div className="w-full space-y-3">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="w-full bg-primary hover:bg-primary/90 text-white font-poppins font-semibold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg"
              >
                {t('logout')}
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full bg-transparent border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-poppins font-semibold py-4 rounded-2xl transition-all"
              >
                {t('stay_logged_in')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompleteProfile;
