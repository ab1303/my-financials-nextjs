# Lint Strong-Typing Recipes

Concrete before/after transformations for every lint warning class encountered
in this repo. Used by the [`lint-reduction-loop`](../../.agents/skills/lint-reduction-loop/SKILL.md)
skill. Each recipe has an **ID**, **trigger**, **forbidden alternative**, and
**transformation**.

> **Hard rule.** Recipes never disable rules, never widen public APIs, never
> use `as any`. If your case does not match an existing recipe, stop and add
> a new recipe — do not invent a workaround inline.

---

## R-VI-MOCKED — Use `vi.mocked` instead of `as any` for mock access

**Trigger.** Accessing mock methods like `mockResolvedValue`,
`mockReturnValue`, `mockImplementation` via an `as any` cast.

**Forbidden.** `(prismaMock.transaction.groupBy as any).mockResolvedValue(…)`.

**Why it happens.** Deep-mock proxies have complex generic signatures; the
authoring agent reached for `any` instead of `vi.mocked`.

**Transformation.**

```ts
// BEFORE
(prismaMock.transaction.groupBy as any).mockResolvedValue([…] as any);

// AFTER
vi.mocked(prismaMock.transaction.groupBy).mockResolvedValue([…] as never);
```

`vi.mocked` preserves the original function signature, so `mockResolvedValue`
type-checks against the real return type. `as never` is acceptable here only
because the mock value is a deliberately narrow shape — see `R-PRISMA-MOCK`.

---

## R-PRISMA-MOCK — Fixture factory for Prisma model rows

**Trigger.** Test fixture object cast with `as any` to satisfy a Prisma row
return type (e.g. `Business`, `Transaction`, `IncomeSource`).

**Forbidden.** `prismaMock.business.create.mockResolvedValue(mock as any)`.

**Why it happens.** Prisma row types include every nullable column. Hand-typing
each one is tedious, so the agent caves to `any`.

**Transformation.** Create a local factory that returns the full model row;
pass overrides for fields the test cares about.

```ts
import type { Business } from '@prisma/client';

const createBrokerage = (overrides?: Partial<Business>): Business => ({
  id: 'brokerage-1',
  name: 'Fidelity',
  institutionKey: null,
  addressLine: null,
  streetAddress: null,
  suburb: null,
  postcode: null,
  state: null,
  userId: null,
  type: 'BROKERAGE',
  isDgrRegistered: null,
  ...overrides,
});

// Usage
prismaMock.business.create.mockResolvedValue(
  createBrokerage({ name: 'Charles Schwab' }),
);
```

**Acceptable narrowing.** If the test asserts on a `findUnique({ select: {…} })`
shape, prefer `R-PRISMA-PAYLOAD` instead of a full-row factory.

**When `as never` is OK.** Inside `vi.mocked(...).mockResolvedValue(value as never)`
where `value` is intentionally a narrow subset and the deep-mock typing makes
the full type impractical. **Never** use `as any`.

---

## R-PRISMA-PAYLOAD — `Prisma.XGetPayload<{ select: {…} }>` for slice shapes

**Trigger.** Service or test code consumes only a subset of a Prisma row and
the author hand-rolled an interface or cast to `any`.

**Forbidden.** `const callArg = mock.calls[0][0] as any;` then inspecting
`callArg.where.date.gte`.

**Transformation.** Use Prisma's payload helper:

```ts
import type { Prisma } from '@prisma/client';

type IncomeTxRow = Prisma.TransactionGetPayload<{
  select: {
    id: true;
    date: true;
    amount: true;
    category: true;
    source: true;
  };
}>;

prismaMock.transaction.findMany.mockResolvedValue([] as IncomeTxRow[]);
```

For `where` shape inspection:

```ts
type FindManyArgs = { where?: Prisma.TransactionWhereInput };
const callArg = vi.mocked(prismaMock.transaction.findMany).mock.calls[0]?.[0]
  as FindManyArgs;
const dateFilter = callArg.where?.date as Prisma.DateTimeFilter<'Transaction'>;
expect(dateFilter?.gte).toEqual(new Date('2024-01-01'));
```

---

## R-AUTH-MOCK-HELPER — `unknown`-safe auth mock helper

**Trigger.** `vi.mocked(auth).mockResolvedValue(mockSession)` fails type-check
because NextAuth's `auth` overloads include middleware signatures, so the
parameter type is `NextMiddleware` and the agent reaches for `as any`.

**Forbidden.**

```ts
vi.mocked(auth).mockResolvedValue(mockSession as any);
(vi.mocked(auth) as any).mockResolvedValue(null);
```

**Transformation.** A single typed helper, defined per test file, that takes
`unknown`:

```ts
type AuthMock = { mockResolvedValue: (value: unknown) => void };
const setAuthMock = (value: unknown) => {
  (auth as unknown as AuthMock).mockResolvedValue(value);
};

// Usage
setAuthMock(mockSession);
setAuthMock(null);
```

The `unknown` boundary is narrow (one helper, one type), not pervasive.

---

## R-TRPC-CALLER-CONTEXT — Typed tRPC caller context

**Trigger.** `appRouter.createCaller({ prisma, session } as any)`.

**Forbidden.** `as any` on the context object.

**Transformation.** Use the inferred parameter type of `createCaller`:

```ts
type CallerContext = Parameters<typeof appRouter.createCaller>[0];

const caller = appRouter.createCaller({
  prisma: prismaMock,
  session: { user: { id: 'user-1' } },
} as unknown as CallerContext);
```

`as unknown as CallerContext` is acceptable here because `prismaMock` is a
deep-mock proxy whose nominal type does not match `PrismaClient` exactly. The
context shape itself is checked.

---

## R-DECIMAL-LITERAL — `new Decimal(N)` instead of fake Decimal objects

**Trigger.** `{ toNumber: () => 100 } as any` used to fake a `Decimal` amount.

**Forbidden.** Any object literal cast to satisfy a Prisma `Decimal` column.

**Transformation.**

```ts
import { Decimal } from '@prisma/client/runtime/library';

const mockTx = {
  id: 'tx-1',
  amount: new Decimal(100),
  // …
};
```

---

## R-MOCK-CALL-ARGS — Typed `mock.calls` inspection

**Trigger.** Inspecting `vi.fn().mock.calls[0][0]` and casting to `any` to drill
into the value.

**Forbidden.** `(mockedFn as any).mock.calls[0][0]`.

**Transformation.**

```ts
type FetchMock = { mock: { calls: Array<[RequestInfo | URL]> } };

const firstCall = String(
  (global.fetch as unknown as FetchMock).mock.calls[0]?.[0] ?? '',
);
expect(firstCall).toContain('calendarYearId=year-1');
```

For Prisma `findMany` call inspection, prefer `R-PRISMA-PAYLOAD`.

---

## R-COMPONENT-PROPS — Local prop types for mocked React components

**Trigger.** `vi.mock('@/components/Foo', () => ({ Foo: ({ data }: any) => … }))`.

**Forbidden.** `any` on the prop destructure of a mocked component.

**Transformation.** Define a minimal local type matching only the prop fields
the mock reads:

```ts
type TrendPoint = { income: number; expenses: number };

vi.mock('@/components/IncomeExpenseTrendChart', () => ({
  IncomeExpenseTrendChart: ({ data }: { data: TrendPoint[] }) => (
    <div data-testid='trend-chart' data-count={data.length} />
  ),
}));
```

Union or grouped shapes need a discriminator type guard:

```ts
type SelectOption = { id: string };
type SelectGroup = { label: string; options: SelectOption[] };

const isSelectGroup = (
  value: SelectOption | SelectGroup,
): value is SelectGroup => 'label' in value;
```

---

## R-UNKNOWN-ERROR — `unknown` + `instanceof Error` for catch blocks

**Trigger.** `catch (error: any)` or `error as any` in service code.

**Forbidden.** Typing a `catch` variable as anything other than `unknown`.

**Transformation.**

```ts
try {
  // …
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  // …
}
```

Reuse a small helper if used in more than two places:

```ts
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
```

---

## R-UNUSED-VAR — Remove, do not rename to `_x`

**Trigger.** `@typescript-eslint/no-unused-vars`.

**Forbidden.** Renaming the binding to `_x` solely to silence the rule when
the binding is genuinely unused.

**Transformation.**

- **Unused import.** Remove the import.
- **Unused destructured parameter.** Remove from the destructure.
- **Unused callback parameter.** Remove the parameter:

```ts
// BEFORE
.mockImplementation((e) => { return; });
// AFTER
.mockImplementation(() => { return; });
```

- **Unused local variable.** Delete the declaration. If the assignment has a
  side effect, keep only the side effect: `await fn()` instead of
  `const result = await fn()`.

The `_` prefix exception applies only to **required** positional parameters
in a typed callback signature you cannot reduce.

---

## R-HOOK-DEPS — `react-hooks/exhaustive-deps`

**Trigger.** `React Hook useEffect/useLayoutEffect/useMemo has a missing
dependency: 'x'`.

**Forbidden.**

- `// eslint-disable-next-line react-hooks/exhaustive-deps`
- Adding an empty `// eslint-disable …` comment block above the hook
- Removing the dependency array to silence the rule

**Decision tree.**

1. **Is the missing dep genuinely needed inside the effect?**
   Add it to the deps array. Done.
2. **Does adding it cause unwanted re-runs?**
   Stabilise the dep:
   - Wrap callbacks in `useCallback(..., [stableDeps])`.
   - Wrap objects/arrays in `useMemo(..., [stableDeps])`.
   - Use `useRef` for values that should be read inside the effect without
     triggering re-runs (e.g. mutable "latest value" pattern).
3. **Is the value only needed once on mount?**
   Lift the value out of render or compute it inside the effect itself so it
   does not need to be a dep.
4. **Is the value a function imported from a module?**
   It is already stable — but ESLint cannot prove that. Restructure the call
   site (assign to a local first) or accept the dep in the array; the import
   reference is referentially stable so it adds no re-runs.

**Last-resort exception.** If a closure must intentionally capture stale state
(rare, real cases exist for animation loops), this rule cannot be satisfied
by typing alone. **Stop and ask the user** — this is not a lint-loop fix; it
is a design decision.

---

## R-HOOK-RULES — `react-hooks/rules-of-hooks` false positives

**Trigger.** A callback parameter prefixed with `use` triggers the hooks rule
even though it is not a hook. Common in Playwright fixtures
(`({ page, context }, use) => …`).

**Forbidden.**

- `// eslint-disable-next-line react-hooks/rules-of-hooks`

**Transformation.** Rename the parameter to a non-`use*` identifier:

```ts
// BEFORE — Playwright fixture, lint flags `use(value)` as a hook call.
export const test = base.extend({
  authedPage: async ({ page }, use) => {
    await page.goto('/login');
    await use(page);
  },
});

// AFTER — rename `use` to `applyFixture`.
export const test = base.extend({
  authedPage: async ({ page }, applyFixture) => {
    await page.goto('/login');
    await applyFixture(page);
  },
});
```

For React components/hooks the rule is correct — never use this recipe to
work around a real violation. Use only when the offending identifier is a
parameter that happens to be `use`-prefixed.

---

## R-UNKNOWN — fallback

If a warning rule has no entry in this library, the loop must **STOP**. Do
not invent a workaround. Report the rule and a minimal reproduction to the
user, wait for them to add a new recipe, then resume.

---

## Cross-cutting rules

1. **Never add `eslint-disable` comments.** Even a single-line disable is a
   global behavior change to the codebase's lint contract.
2. **Never edit `eslint.config.*` or `tsconfig.json`** during a lint reduction
   pass. Those are config changes, not lint fixes.
3. **Never widen a function signature** (parameter type or return type) to
   silence a downstream lint warning. Fix the call site instead.
4. **Never run global formatters** (`prettier --write`, `eslint --fix`,
   `vitest --update`) during a lint reduction iteration.
5. **`as never` vs `as any`.** `as never` is acceptable narrowly inside
   `vi.mocked(...).mockResolvedValue(value as never)` to opt out of the deep-
   mock proxy's broad parameter type when the fixture is intentionally a
   subset. `as any` is **always** forbidden.

---

## Adding a new recipe

When the loop encounters a warning with no matching recipe:

1. Stop. Do not patch the file with a workaround.
2. Report the rule, the file, and a minimal reproduction to the user.
3. Wait for the user to author a new recipe in this file.
4. Resume the loop only after the recipe is committed.

The recipe library is the contract. The loop is only safe because the recipe
library is exhaustive within its scope.
