'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';
import type { UserProfileData } from '../_types';

interface AvatarUploadProps {
  profile: UserProfileData;
  onAvatarChanged: () => void;
}

function getInitials(name: string | null, email: string | null): string {
  const source = name ?? email ?? '?';
  return source
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AvatarUpload({ profile, onAvatarChanged }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const hasUploadedAvatar = Boolean(profile.avatarStorageUrl);
  const effectiveSrc =
    previewSrc ??
    (hasUploadedAvatar ? `/api/avatar/${profile.id}` : null) ??
    profile.image ??
    null;
  const initials = getInitials(profile.name, profile.email);

  const uploadMutation = trpc.userProfile.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success('Avatar updated');
      setPreviewSrc(null);
      onAvatarChanged();
    },
    onError: (error) => {
      toast.error(error.message);
      setPreviewSrc(null);
    },
  });

  const deleteMutation = trpc.userProfile.deleteAvatar.useMutation({
    onSuccess: () => {
      toast.success('Avatar removed');
      setPreviewSrc(null);
      onAvatarChanged();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewSrc(objectUrl);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const base64 = dataUrl.split(',')[1] ?? '';

      uploadMutation.mutate({
        fileBase64: base64,
        mimeType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const isLoading = uploadMutation.isPending || deleteMutation.isPending;

  return (
    <div className='flex items-center gap-6'>
      <div className='relative h-20 w-20 shrink-0'>
        {effectiveSrc ? (
          <img
            src={effectiveSrc}
            alt='Profile avatar'
            className='h-20 w-20 rounded-full object-cover ring-2 ring-teal-500 dark:ring-teal-400'
          />
        ) : (
          <div className='flex h-20 w-20 select-none items-center justify-center rounded-full bg-teal-600 text-2xl font-bold text-white dark:bg-teal-500'>
            {initials}
          </div>
        )}
        {isLoading && (
          <div className='absolute inset-0 flex items-center justify-center rounded-full bg-black/40'>
            <div className='h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent' />
          </div>
        )}
      </div>

      <div>
        <p className='mb-1 text-sm text-muted-foreground dark:text-gray-400'>
          JPG, PNG or WebP. Max 5MB.
        </p>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className='rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
          >
            Upload Photo
          </button>
          {hasUploadedAvatar && !previewSrc && (
            <button
              type='button'
              onClick={() => deleteMutation.mutate()}
              disabled={isLoading}
              className='rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/20'
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/png,image/jpeg,image/webp'
          className='hidden'
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
