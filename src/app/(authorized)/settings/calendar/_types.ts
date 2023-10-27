export type CALENDAR_KEYS_TYPE = 'ZAKAT' | 'ANNUAL' | 'FISCAL';
export type CALENDAR_MAP_TYPE = {
  [P in CALENDAR_KEYS_TYPE]: string;
};

export type ServerActionType = {
  success: boolean;
  error: unknown;
};

const CALENDAR_MAP: CALENDAR_MAP_TYPE = {
  ZAKAT: 'ZAKAT',
  ANNUAL: 'ANNUAL',
  FISCAL: 'FISCAL',
} as const;

const CALENDAR_KEYS = Object.entries(CALENDAR_MAP).map(
  ([k]) => k as CALENDAR_KEYS_TYPE
);

export { CALENDAR_MAP, CALENDAR_KEYS };
