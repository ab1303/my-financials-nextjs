import type { ActionMapUnion } from '@/types';

import type { IncomeEntryType } from './_types';

import { produce } from 'immer';

type IncomeMessages = {
  'INCOME/Entries/INITIAL_DATA': IncomeEntriesState;
  'INCOME/Entries/ADD_ENTRY': {
    incomeEntryId: string;
    entry: IncomeEntryType;
  };
  'INCOME/Entries/EDIT_ENTRY': {
    incomeEntryId: string;
    entry: IncomeEntryType;
  };
  'INCOME/Entries/REMOVE_ENTRY': {
    incomeEntryId: string;
  };
};

export type IncomeEntriesState = {
  data: Array<IncomeEntryType>;
};

export type Actions = ActionMapUnion<IncomeMessages>;

export const incomeEntryReducer = produce<IncomeEntriesState, [Actions]>(
  (draft, action) => {
    switch (action.type) {
      case 'INCOME/Entries/INITIAL_DATA': {
        draft.data = action.payload.data;
        break;
      }
      case 'INCOME/Entries/ADD_ENTRY': {
        const { entry } = action.payload;
        draft.data.push(entry);
        break;
      }

      case 'INCOME/Entries/EDIT_ENTRY': {
        const { entry, incomeEntryId } = action.payload;
        const editedEntry = draft.data.find((d) => d.id === incomeEntryId);

        if (!editedEntry) return;

        editedEntry.amount = entry.amount;
        editedEntry.incomeSourceId = entry.incomeSourceId;
        editedEntry.incomeSourceName = entry.incomeSourceName;
        editedEntry.dateEarned = entry.dateEarned;
        break;
      }

      case 'INCOME/Entries/REMOVE_ENTRY': {
        const { incomeEntryId } = action.payload;
        draft.data = draft.data.filter((d) => d.id !== incomeEntryId);
        break;
      }

      default:
        return draft;
    }
  },
);
