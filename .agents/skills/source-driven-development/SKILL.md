---
name: source-driven-development
description: >
  Ground every framework decision in official source documentation before
  writing code. Verify, cite, and flag what's unverified. Use when implementing
  features that touch Next.js, Prisma, NextAuth, tRPC, Tailwind, Flowbite, or
  any external library; when fixing bugs that may stem from misremembered API;
  when a small/cheap model is doing the work and hallucination risk is highest.
metadata:
  author: local
  version: "1.0.0"
  inspiredBy: addyosmani/agent-skills/skills/source-driven-development
  upstreamSha: aba7c4e9695c363e65cb59effe926c7f1d1abe3d
  upstreamReviewedAt: "2026-06-30"
  upstreamReviewCadence: quarterly
  argument-hint: <feature-or-question>
---

# Source-Driven Development

Cheap models hallucinate framework APIs. This skill forces every framework-touching
decision through a **cite-or-flag** gate so the agent either grounds itself in
official docs or explicitly marks the claim as unverified — never silently
guesses.

This is the single highest-leverage skill for running implementation work on
Haiku-class / GPT-4.1-mini-class models in this repo. Anthropic's published
delta on source-grounded prompts is ~30% lower hallucination rate; in this
codebase the dominant failure is invented Prisma / NextAuth v5-beta / tRPC v11
APIs that no longer match installed versions.

---

## When to Use

Invoke this skill whenever the work involves:

- A **framework decision** — choosing a Next.js App Router pattern, a Prisma
  query shape, a NextAuth v5-beta callback, a tRPC procedure style, a
  Tailwind/Flowbite component variant, an `ai` SDK function.
- A **bug suspected to be a misused API** — symptoms like
  "this worked yesterday", "type errors after version bump", or
  "the docs example doesn't run".
- A **small/cheap model is implementing** — assume hallucination risk by
  default; mandate citations.
- A **library upgrade** — every removed/renamed/deprecated symbol must be
  verified, never inferred.

**Skip** for purely internal logic (Zod schemas, pure utility functions,
component composition with no external API surface).

---

## The Cite-or-Flag Rule

Every framework claim falls into one of three buckets. Each bucket has a
required format the agent must use when proposing code:

| Bucket             | When                                                          | Required format                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cited**          | You can point to an official source (docs, types, source code) | `// SOURCE: <url-or-path>#<anchor-or-line>` directly above the line, **or** a `Sources:` block at the end of the response                                                  |
| **Verified-local** | You inspected the installed package and copied the actual type/export | `// VERIFIED-LOCAL: node_modules/<pkg>/<file>:<line>` — must be a real path the user can `view`                                                                            |
| **Unverified**     | You don't have a source and aren't going to fetch one         | `// UNVERIFIED: <reason>` — the user MUST see this before merging. Never silently emit unverified API usage.                                                               |

If a claim is `Unverified`, the agent must **stop and ask** before relying on
it for more than a single line of code. Stacking unverified claims is the
fastest path to incoherent output.

---

## Authoritative Sources for This Repo

Use this routing table to pick the right primary source per framework. Prefer
locally installed `node_modules` source when the runtime version is what
matters; prefer the live docs when the question is conceptual.

| Framework / lib       | Primary source (live docs)                                    | Local fallback                                       | Version pin                |
| --------------------- | ------------------------------------------------------------- | ---------------------------------------------------- | -------------------------- |
| Next.js App Router    | https://nextjs.org/docs/app                                   | `node_modules/next/dist/`                            | check `package.json`       |
| Prisma                | https://www.prisma.io/docs                                    | `node_modules/@prisma/client/`                       | `prisma --version`         |
| NextAuth v5 (beta)    | https://authjs.dev/getting-started                            | `node_modules/next-auth/`                            | beta — pin matters         |
| tRPC v11              | https://trpc.io/docs                                          | `node_modules/@trpc/server/`                         | check installed major      |
| Tailwind CSS          | https://tailwindcss.com/docs                                  | `tailwind.config.ts`                                 | v3 vs v4 matters           |
| Flowbite / Flowbite-React | https://flowbite-react.com/docs                           | `node_modules/flowbite-react/`                       | watch breaking changes     |
| Zod                   | https://zod.dev                                               | `node_modules/zod/`                                  | v3 vs v4 matters           |
| `ai` SDK              | https://sdk.vercel.ai/docs                                    | `node_modules/ai/`                                   | move fast — verify         |
| `@ai-sdk/openai`      | https://sdk.vercel.ai/providers/openai                        | `node_modules/@ai-sdk/openai/`                       | move fast — verify         |
| Playwright            | https://playwright.dev/docs                                   | `node_modules/@playwright/test/`                     | check installed            |
| Vitest                | https://vitest.dev                                            | `node_modules/vitest/`                               | check installed            |

**MCP shortcut:** Context7 MCP (if configured) auto-resolves library docs for
the installed version. Prefer it when available — it eliminates the
"docs are for a newer version than installed" trap.

---

## Process

### Step 1 — Identify framework touch-points

Before writing any code, list every external symbol the change will touch.
Example: implementing a category-group CRUD might touch
`prisma.categoryGroup.create`, `z.object`, `protectedProcedure`,
`createTRPCRouter`, `Flowbite Modal`.

### Step 2 — Triage each touch-point

For each, decide: do I already know this from inspecting code in this session?
If yes → mark `Verified-local`. If no → fetch a source.

### Step 3 — Fetch sources cheaply

Preference order, cheapest first:

1. **`view` `node_modules/<pkg>/dist/index.d.ts`** — types are the highest-fidelity, lowest-token source.
2. **`view` a `package.json`** to confirm the installed version before trusting any external doc.
3. **`grep` existing usages in `src/`** — if the project already calls this API in 3+ places, mirror the existing pattern.
4. **`web_fetch` the official docs page** — last resort because docs may describe a different version.

### Step 4 — Emit code with inline citations

Every framework-touching line gets a `// SOURCE:` / `// VERIFIED-LOCAL:` /
`// UNVERIFIED:` comment **on first use within a file** (not every line).

### Step 5 — Strip citations after verification gate passes

Once `pnpm run type-check` and `pnpm run lint` pass for the change, the
citations have served their purpose. Move them to a single `Sources:` block
in the PR description / commit body and remove the inline `// SOURCE:`
comments — leaving them inline forever adds noise. **Keep** any
`// UNVERIFIED:` markers; those must be resolved before merge.

---

## Coupling With the Spec Manifest

When `spec/index.json` says `phase: "build"` for the active feature, citations
are **mandatory** for every external API call. When `phase: "post-build"` and
the feature has an `invariants` block, you may rely on those invariants
without re-citing, but only for behaviours explicitly listed there.

This is what makes the harness cheap to run on small models without losing
fidelity: the manifest tells the agent *when* it can shortcut, and this skill
forces grounding *when it can't*.

---

## Anti-Rationalisations

| The agent says…                                                       | Reality                                                                                                                                              |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I know this API, no need to check"                                   | The API may have changed between minor versions. Cost of a 200-token `view` is far less than cost of a wrong implementation discovered in CI.        |
| "The docs example looked like this"                                   | Which version? Which framework? Cite the URL with anchor or stop.                                                                                    |
| "Let me just try it and see if types pass"                            | Type-check passing ≠ runtime correctness. NextAuth v5-beta is a classic offender — types pass on calls that throw at runtime.                        |
| "I'll add `// TODO: verify this` and move on"                         | That's a synonym for `// UNVERIFIED:`. Use the real marker so the gate catches it.                                                                   |
| "Citations bloat the diff"                                            | They get stripped at Step 5. The bloat is temporary; the fidelity is permanent.                                                                      |

---

## Red Flags

- A function signature you can't trace to a `.d.ts` file in `node_modules`.
- A doc URL you can't open / verify.
- "This is how it worked in v4" — version drift is the dominant cause of wrong code.
- A subagent emitting `import { X } from 'pkg'` where `X` isn't in that package's
  exports — the single most common Haiku-class hallucination.
- More than 2 `// UNVERIFIED:` markers in a single file → stop and ask.

---

## Verification

This skill is honoured when:

- [ ] Every framework-touching line either has a citation or an explicit `// UNVERIFIED:` marker.
- [ ] No `// UNVERIFIED:` survives into a merged commit.
- [ ] `pnpm run type-check` and `pnpm run lint` pass.
- [ ] Sources are recorded in the commit body / PR description.

If the agent cannot satisfy these, the work is **not done** regardless of
whether the feature appears to function.
