import type {
  CalendarEnumType,
  CurrencyEnumType,
  StorageProviderEnum,
} from '@prisma/client';

export interface UserProfileData {
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
  createdAt: string;
  isCredentialsUser: boolean;
}

export interface UpdateProfileInput {
  name: string;
  phone?: string | null;
  bio?: string | null;
  timezone: string;
  linkedInUrl?: string | null;
  preferredCurrency: CurrencyEnumType;
  fiscalYearType: CalendarEnumType;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UploadAvatarInput {
  fileBase64: string;
  mimeType: string;
  fileName: string;
}
