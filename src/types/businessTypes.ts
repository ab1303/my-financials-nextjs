import type { CalendarYearType } from '@/app/(authorized)/settings/calendar/_types';

export type Address = {
  addressLine: string;
  street_address: string;
  suburb: string;
  postcode: string;
  state: string;
};

export type OptionType = {
  label: string;
  id: string;
};

export type BankType = {
  bankName: string;
  address: Address;
};

export type ProfileType = {
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  contact: string;
};

export { CalendarYearType };
