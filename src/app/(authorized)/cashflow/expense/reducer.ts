import type { ActionMapUnion } from '@/types';
import type { ExpenseEntryWithCategory } from '@/server/models/expense';
import { produce } from 'immer';

type ExpenseMessages = {
  'EXPENSE/Entries/INITIAL_DATA': ExpenseEntriesState;
  'EXPENSE/Entries/ADD_ENTRY': {
    entry: ExpenseEntryWithCategory;
  };
  'EXPENSE/Entries/EDIT_ENTRY': {
    expenseEntryId: string;
    entry: Partial<ExpenseEntryWithCategory>;
  };
  'EXPENSE/Entries/REMOVE_ENTRY': {
    expenseEntryId: string;
  };
};

export type ExpenseEntriesState = {
  data: Array<ExpenseEntryWithCategory>;
};

export type Actions = ActionMapUnion<ExpenseMessages>;

export const expenseEntryReducer = produce<ExpenseEntriesState, [Actions]>(
  (draft, action) => {
    switch (action.type) {
      case 'EXPENSE/Entries/INITIAL_DATA': {
        draft.data = action.payload.data;
        break;
      }
      case 'EXPENSE/Entries/ADD_ENTRY': {
        const { entry } = action.payload;
        draft.data.push(entry);
        break;
      }

      case 'EXPENSE/Entries/EDIT_ENTRY': {
        const { entry, expenseEntryId } = action.payload;
        const editedEntry = draft.data.find((d) => d.id === expenseEntryId);

        if (!editedEntry) return;

        if (entry.amount !== undefined) editedEntry.amount = entry.amount;
        if (entry.categoryId !== undefined)
          editedEntry.categoryId = entry.categoryId;
        if (entry.categoryName !== undefined)
          editedEntry.categoryName = entry.categoryName;
        if (entry.month !== undefined) editedEntry.month = entry.month;
        break;
      }

      case 'EXPENSE/Entries/REMOVE_ENTRY': {
        const { expenseEntryId } = action.payload;
        draft.data = draft.data.filter((d) => d.id !== expenseEntryId);
        break;
      }

      default:
        return draft;
    }
  },
);
