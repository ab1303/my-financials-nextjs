export type Category = {
  id: string;
  name: string;
  color?: string;
  type: 'income' | 'expense' | 'other';
  amount: number;
};

export type CategoryGroup = {
  id: string;
  name: string;
  categories: Category[];
};

const mockGroups: CategoryGroup[] = [
  {
    id: 'g-essentials',
    name: 'Essentials',
    categories: [
      { id: 'c-rent', name: 'Rent', color: 'bg-blue-500', type: 'expense', amount: 1200 },
      { id: 'c-groceries', name: 'Groceries', color: 'bg-green-500', type: 'expense', amount: 450 },
    ],
  },
  {
    id: 'g-invest',
    name: 'Investments & Transfers',
    categories: [
      { id: 'c-invest', name: 'Investments', color: 'bg-purple-500', type: 'other', amount: 2000 },
      { id: 'c-transfer', name: 'Transfers', color: 'bg-gray-400', type: 'other', amount: 300 },
    ],
  },
  {
    id: 'g-income',
    name: 'Income',
    categories: [
      { id: 'c-salary', name: 'Salary', color: 'bg-yellow-500', type: 'income', amount: 5000 },
    ],
  },
];

export default mockGroups;
