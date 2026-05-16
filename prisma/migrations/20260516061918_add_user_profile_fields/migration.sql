-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarStorageProvider" "StorageProviderEnum",
ADD COLUMN     "avatarStorageUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "fiscalYearType" "CalendarEnumType" DEFAULT 'FISCAL',
ADD COLUMN     "linkedInUrl" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "preferredCurrency" "CurrencyEnumType" DEFAULT 'AUD',
ADD COLUMN     "timezone" TEXT DEFAULT 'Australia/Sydney';
