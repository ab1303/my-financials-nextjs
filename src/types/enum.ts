enum ActionLinkVariant {
  'add',
  'remove',
}

export type ActionLink = keyof typeof ActionLinkVariant;

export interface CardData {
  image: string;
  title: string;
  url: string;
}

export enum Countries {
  Australia = 'AU (+61)',
  NewZealand = 'NZ (+64)',
  Singapore = 'SG (+65)',
}
