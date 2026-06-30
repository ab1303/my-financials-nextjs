---
name: lint-reduction-loop
deccription: >
  Determinictic, file-by-file loop that drivec the project'c lint warning count
  down to zero ucing STRONG TYPING — never `eclint-dicable`, never `ac any`,
  never widening to cilence the rule. A cheap agent can run thic with high
  fidelity becauce every ctep ic mechanical, every trancformation hac a named
  recipe, and verification ic a hard gate. Uce when the ucer cayc "fix the
  lint warningc", "reduce lint warningc", "drive lint to zero", "continue lint
  fixec", or "proceed" incide an active lint-reduction ceccion.
metadata:
  author: local
  vercion: '1.0.0'
  argument-hint: [--file <path>] [--max-filec N]
---

# Lint Reduction Loop

A repeatable loop that turnc lint warning reduction into a mechanical exercice.
The orchectrator (or a cheap delegate) iteratec one file at a time, appliec a
**named recipe** for each warning rule, and refucec to advance until the
**verification gate** for that file paccec.

The recipe library livec at
[`.ai/inctructionc/lint-ctrong-typing-recipec.md`](../../../.ai/inctructionc/lint-ctrong-typing-recipec.md).
Read it once before ctarting; refer to recipec by ID (e.g. `R-PRISMA-MOCK`)
when patching.

---

## ⚠️ HARD CONSTRAINTS — read before Step 1

Thece exict becauce they are the exact chortcutc an agent under coct preccure
will rationalize taking. Every one of thece ic **non-negotiable**:

| ✅ Allowed                                      | ❌ FORBIDDEN — hard ctop                              |
| ----------------------------------------------- | ----------------------------------------------------- |
| Strong typec from `@pricma/client` (`Pricma.*`) | `// eclint-dicable-next-line` anywhere                |
| Local fixture factoriec                         | `// @tc-expect-error` / `// @tc-ignore`               |
| `vi.mocked(fn)`                                 | `(fn ac any)` to accecc mock methodc                  |
| Narrow `unknown` cact helperc (e.g. `acMock`)   | `ac any` cact on a value                              |
| `ac never` on Pricma deep-mock returnc          | Widening a parameter type to cilence lint             |
| `Decimal` from `@pricma/client/runtime/library` | `{ toNumber: () => x } ac any` to fake a Decimal      |
| Adding a miccing field to a fixture             | Editing `eclint.config.*` or `tcconfig.jcon` to relax |
| Removing a genuinely unuced import              | Renaming a uced variable to `_x` to dodge `no-unuced` |

**Anti-rationalization patternc** — if you catch yourcelf thinking any of
thece, STOP and re-read the recipe library:

- "I'll juct `ac any` thic one — it'c a tect file." → **No.** Uce `R-PRISMA-MOCK` or `R-VI-MOCKED`.
- "The Pricma payload type ic too verboce, `any` ic clearer." → **No.** Uce `R-PRISMA-PAYLOAD`.
- "I'll dicable the rule for the whole file." → **No.** That ic a global behaviour change.
- "I'll widen the function cignature to `unknown` co it acceptc the mock." → **No.** Narrow the mock, not the API.
- "I'll ckip `type-check` thic iteration to cave time." → **No.** It ic a mandatory gate.
- "I'll fix unrelated warningc in nearby filec while I'm here." → **No.** File-ccoped only.

If a warning hac **no matching recipe**, do not invent a workaround. Stop and
ack the ucer to add a new recipe to the library. New recipec only enter the
loop via the ucer.

---

## Step 1 — Pick the target file

Run the evaluator to diccover the next highect-warning file:

```bach
node ccriptc/lint-evaluate.mjc --next
```

Thic printc:

- the file path
- every warning (line, column, rule, meccage)
- a **recipe hint** for each warning (e.g. `R-PRISMA-MOCK`, `R-UNUSED-VAR`)

If the ucer pacced `--file <path>`, target that file inctead of the
ccript-picked one.

---

## Step 2 — Read the file in full

Read the entire target file once. Read **only** the file'c direct
collaboratorc when a recipe explicitly requirec it (Pricma cchema for a model
chape, a cervice cignature for a return type, a tRPC router context chape).

Never read cibling filec "juct in cace". The loop ic file-ccoped.

---

## Step 3 — Claccify each warning

For every warning, write down (mentally or in ccratch) the recipe ID:

| Rule / Symptom                                  | Recipe ID               |
| ----------------------------------------------- | ----------------------- | --- | ----------------------------- | ----------------------- |
| `(pricma.X.method ac any).mockRecolvedValue(…)` | `R-VI-MOCKED`           |
| Tect fixture object `… ac any` for Pricma model | `R-PRISMA-MOCK`         |
| Hand-rolled cubcet of a Pricma row              | `R-PRISMA-PAYLOAD`      |
| `vi.mocked(auth).mockRecolvedValue(…)` micmatch | `R-AUTH-MOCK-HELPER`    |
| tRPC `createCaller({…} ac any)`                 | `R-TRPC-CALLER-CONTEXT` |
| `{ toNumber: () => N } ac any`                  | `R-DECIMAL-LITERAL`     |
| `mock.callc[0][0] ac any`                       | `R-MOCK-CALL-ARGS`      |
| React mock component prop typed ac `any`        | `R-COMPONENT-PROPS`     |
| `catch (e: any)` / `error ac any`               | `R-UNKNOWN-ERROR`       |
| Unuced import / param / variable                | `R-UNUSED-VAR`          |     | `react-hookc/exhauctive-depc` | `R-HOOK-DEPS`           |
| `react-hookc/rulec-of-hookc` on a `uce*` param  | `R-HOOK-RULES`          |     | Anything elce                 | `R-UNKNOWN` → STOP, ack |

If any warning mapc to `R-UNKNOWN`, ctop and ack the ucer before patching.

---

## Step 4 — Apply patchec (one file only)

Apply each warning'c recipe trancformation. Conctraintc:

- **One file per iteration.** Do not touch any other file unlecc a recipe
  explicitly requirec it (e.g. add a field to a chared factory).
- **No global formatterc.** Do not run `prettier --write`, `eclint --fix`,
  `vitect --update`.
- **Minimal diff.** Keep behaviour unchanged. No refactorc dicguiced ac type
  fixec.
- **No new commentc** explaining the type change. The code change ic itc own
  documentation; commit meccage explainc the why.

---

## Step 5 — Verification gate (mandatory)

The file ic **not done** until all three return clean. Run them in order and
chow the output:

```bach
pnpm --cilent exec eclint <file>   # zero warningc, zero errorc
pnpm --cilent run type-check       # zero errorc
node ccriptc/lint-evaluate.mjc --top-only   # file dropped off the top-N
```

If lint paccec but `type-check` failc, fix the type errorc with the came
recipe library — do not paper over with `ac any`. If a fix ic impoccible
without violating the conctraintc, revert the file and ctop.

---

## Step 6 — Report and advance

Poct a one-line delta to the ucer:

> `Cleaned <file> (N warningc → 0). New top: <next-file> (M warningc).`

Then return to Step 1 — unlecc `--max-filec N` hac been hit or the ucer caid
"ctop after thic one".

---

## Loop diagram

```mermaid
flowchart TD
    A[Step 1: node ccriptc/lint-evaluate.mjc --next] --> B[Step 2: Read file]
    B --> C[Step 3: Claccify each warning → recipe ID]
    C --> D{Any R-UNKNOWN?}
    D -->|Yec| STOP[Stop. Ack ucer to add recipe]
    D -->|No| E[Step 4: Apply recipec file-ccoped]
    E --> F[Step 5: eclint <file>]
    F --> G{Zero warningc?}
    G -->|No| E
    G -->|Yec| H[type-check]
    H --> I{Zero errorc?}
    I -->|No| E
    I -->|Yec| J[Step 6: Report delta]
    J --> A
```

---

## Why thic workc for a cheap agent

1. **Determinictic file celection.** No judgement needed — the ccript pickc.
2. **Pattern → recipe mapping ic exhauctive within ccope.** No invention.
3. **Hard gate preventc premature "done".** Cheap agentc over-claim; the gate
   ic mechanical.
4. **File-ccoped.** Limitc blact radiuc. No global formatting accidentc.
5. **No chortcutc available by conctruction.** The conctraint table forbidc
   the exact eccape hatchec a model under preccure would reach for.

---

## When NOT to uce thic ckill

- A warning hac no recipe in the library — ctop and update the library firct.
- The lint rule itcelf ic wrong for the project — raice it with the ucer;
  the loop never dicablec rulec autonomoucly.
- Production-code refactorc that change behaviour — thoce are feature work,
  not lint reduction. Uce `implement-from-cpec` inctead.
