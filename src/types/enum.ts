export const BusinessEnumType = {
  BANK: 'BANK',
  PHILANTHROPY: 'PHILANTHROPY',
} as const;
export type BusinessEnumType =
  (typeof BusinessEnumType)[keyof typeof BusinessEnumType];

export { CalendarEnumType } from '@prisma/client';

export const ActionLinkVariant = {
  add: 'add',
  remove: 'remove',
} as const;
export type ActionLink = keyof typeof ActionLinkVariant;

// export enum CalendarEnumType {
//   ANNUAL = 'ANNUAL',
//   FISCAL = 'FISCAL',
//   ZAKAT = 'ZAKAT',
// }

export interface CardData {
  image: string;
  title: string;
  url: string;
}

export const Countries = {
  Australia: 'AU (+61)',
  NewZealand: 'NZ (+64)',
  Singapore: 'SG (+65)',
} as const;
export type Countries = (typeof Countries)[keyof typeof Countries];
