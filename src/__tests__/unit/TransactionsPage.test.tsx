import { describe, expect, it, vi } from 'vitest';




const authMock = vi.hoisted(() => vi.fn());

const prismaFindManyMock = vi.hoisted(() => vi.fn());



vi.mock('@/server/auth', () => ({

  auth: (...args: unknown[]) => authMock(...args),

}));



vi.mock('@/server/db/client', () => ({

  prisma: {

    bankAccount: {

      findMany: (...args: unknown[]) => prismaFindManyMock(...args),

    },

  },

}));



vi.mock('@/app/(authorized)/cashflow/transactions/_components/TransactionsClient', () => ({

  default: () => null,

}));



describe('TransactionsPage', () => {

  it('parses initial filter params from searchParams', async () => {

    authMock.mockResolvedValue({ user: { id: 'user-1' } });

    prismaFindManyMock.mockResolvedValue([

      {

        id: 'acc-1',

        name: 'Everyday Account',

        bank: { name: 'CommBank' },

      },

    ]);



    const { default: TransactionsPage } = await import(

      '@/app/(authorized)/cashflow/transactions/page'

    );



    const element = await TransactionsPage({

      searchParams: Promise.resolve({

        category: 'Groceries',

        month: '2',

        year: '2025',

      }),

    } as never);



    expect(element.props).toEqual(

      expect.objectContaining({

        bankAccounts: [

          {

            id: 'acc-1',

            name: 'Everyday Account',

            bankName: 'CommBank',

          },

        ],

        initialCategory: 'Groceries',

        initialMonth: 2,

        initialYear: 2025,

      }),

    );

  });

});

