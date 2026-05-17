import bcrypt from 'bcryptjs';
import { TRPCError } from '@trpc/server';
import type {
  CalendarEnumType,
  CurrencyEnumType,
  PrismaClient,
  StorageProviderEnum,
} from '@prisma/client';
import type {
  UpdateProfileInput,
  UserProfileData,
} from '@/app/(authorized)/settings/profile/_types';
import {
  getStorageAdapter,
  getStorageProviderEnum,
} from '@/server/services/ai-import/image-storage.adapter';

const PROFILE_FIELDS = {
  id: true,
  name: true,
  email: true,
  image: true,
  phone: true,
  bio: true,
  timezone: true,
  linkedInUrl: true,
  preferredCurrency: true,
  fiscalYearType: true,
  avatarStorageUrl: true,
  avatarStorageProvider: true,
  createdAt: true,
  password: true,
} as const;

function mapToProfileData(user: {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  phone: string | null;
  bio: string | null;
  timezone: string | null;
  linkedInUrl: string | null;
  preferredCurrency: CurrencyEnumType | null;
  fiscalYearType: CalendarEnumType | null;
  avatarStorageUrl: string | null;
  avatarStorageProvider: StorageProviderEnum | null;
  createdAt: Date;
  password: string;
}): UserProfileData {
  const isCredentialsUser =
    user.password.startsWith('$2a$') || user.password.startsWith('$2b$');

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    phone: user.phone,
    bio: user.bio,
    timezone: user.timezone,
    linkedInUrl: user.linkedInUrl,
    preferredCurrency: user.preferredCurrency,
    fiscalYearType: user.fiscalYearType,
    avatarStorageUrl: user.avatarStorageUrl,
    avatarStorageProvider: user.avatarStorageProvider,
    createdAt: user.createdAt.toISOString(),
    isCredentialsUser,
  };
}

export async function getProfile(
  prisma: PrismaClient,
  userId: string,
): Promise<UserProfileData> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: PROFILE_FIELDS,
  });

  return mapToProfileData(user);
}

export async function updateProfile(
  prisma: PrismaClient,
  userId: string,
  data: UpdateProfileInput,
): Promise<UserProfileData> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      phone: data.phone ?? null,
      bio: data.bio ?? null,
      timezone: data.timezone,
      linkedInUrl: data.linkedInUrl ?? null,
      preferredCurrency: data.preferredCurrency,
      fiscalYearType: data.fiscalYearType,
    },
    select: PROFILE_FIELDS,
  });

  return mapToProfileData(updated);
}

export async function uploadAvatar(
  prisma: PrismaClient,
  userId: string,
  file: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{ avatarUrl: string }> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarStorageUrl: true },
  });

  const adapter = getStorageAdapter();

  if (existing?.avatarStorageUrl) {
    await adapter.deleteImage(existing.avatarStorageUrl);
  }

  const result = await adapter.uploadImage(
    file,
    mimeType,
    userId,
    fileName,
    'avatars',
  );
  const provider = getStorageProviderEnum();

  await prisma.user.update({
    where: { id: userId },
    data: {
      avatarStorageUrl: result.storageUrl,
      avatarStorageProvider: provider,
    },
  });

  return { avatarUrl: `/api/avatar/${userId}` };
}

export async function deleteAvatar(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarStorageUrl: true },
  });

  if (user?.avatarStorageUrl) {
    const adapter = getStorageAdapter();
    await adapter.deleteImage(user.avatarStorageUrl);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      avatarStorageUrl: null,
      avatarStorageProvider: null,
    },
  });
}

export async function changePassword(
  prisma: PrismaClient,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { password: true },
  });

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Current password is incorrect',
    });
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });
}

export async function getUserFiscalYearType(
  prisma: PrismaClient,
  userId: string,
): Promise<CalendarEnumType | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fiscalYearType: true },
  });
  return user?.fiscalYearType ?? null;
}
