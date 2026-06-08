'use client';

import type { CalendarEnumType } from '@prisma/client';
import { createContext, use } from 'react';

import type { OptionType } from '@/types';

// ─── State / Actions / Context shape ─────────────────────────────────────────

export interface CalendarYearState {
  selectedType: CalendarEnumType;
  applicableTypes: CalendarEnumType[];
  yearOptions: OptionType[];
  selectedOption: OptionType | null;
  /** Accessible label for the year dropdown (e.g. "Fiscal Year", "Annual Year") */
  displayLabel: string;
}

export interface CalendarYearActions {
  onTypeChange: (type: CalendarEnumType) => void;
  onYearChange: (yearId: string | null) => void;
}

export interface CalendarYearContextValue {
  state: CalendarYearState;
  actions: CalendarYearActions;
  /** Stable id shared by <label htmlFor> and <select id> for accessibility */
  labelId: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const CalendarYearContext =
  createContext<CalendarYearContextValue | null>(null);

/**
 * Consume CalendarYearContext inside any CalendarYearPicker sub-component.
 * Throws if called outside a <CalendarYearPicker.Provider>.
 */
export function useCalendarYearContext(): CalendarYearContextValue {
  const ctx = use(CalendarYearContext);
  if (!ctx) {
    throw new Error(
      'CalendarYearPicker sub-components must be rendered within <CalendarYearPicker.Provider>',
    );
  }
  return ctx;
}
