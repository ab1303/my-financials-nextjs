# Instruction File Governance

**Purpose**: Prevent duplicate, conflicting, or confusing rules across AGENTS.md, CLAUDE.md, and GEMINI.md.

---

## File Hierarchy

```
AGENTS.md (source of truth for ALL agents)
  ├─ Universal rules: database, specs, code standards, safety
  ├─ Efficiency, planning, dev server, scope control
  └─ Referenced by CLAUDE.md, GEMINI.md (never duplicated)

CLAUDE.md (Copilot CLI with Claude model)
  ├─ Claude persona & expertise (coding, React, auth)
  ├─ MCP tools available (Playwright, Prisma, Postgres)
  └─ References AGENTS.md for universal rules

GEMINI.md (Copilot CLI with Gemini model)
  ├─ Gemini persona & expertise (similar structure to CLAUDE.md)
  └─ References AGENTS.md for universal rules
```

---

## Rules to Prevent Conflicts

### 1. Single Source of Truth (SSoT)

| Category | Canonical File | Other Files |
|----------|---|---|
| Database safety | `AGENTS.md#Code` | CLAUDE/GEMINI: reference only |
| Prisma migrations | `AGENTS.md#Code` | CLAUDE/GEMINI: reference only |
| Dev server safety | `AGENTS.md#Dev Server Safety` | CLAUDE/GEMINI: reference only |
| Form patterns | `AGENTS.md` (in `.ai/instructions/form-patterns.md`) | CLAUDE/GEMINI: reference only |
| Auth & state | `AGENTS.md` (in `.ai/instructions/auth.md`) | CLAUDE/GEMINI: reference only |
| Spec structure | `AGENTS.md#Spec Documents` | CLAUDE/GEMINI: reference only |
| pnpm usage | `AGENTS.md#Code` line 125 | CLAUDE/GEMINI: reference only |
| **MCP tools** | **CLAUDE.md** (Claude-specific) | GEMINI.md has its own MCP list |
| **Persona** | **CLAUDE.md** (Claude-specific) | GEMINI.md has its own persona |

### 2. Allowed Content by File

#### AGENTS.md (Universal Rules)
✅ Can contain:
- Efficiency guidelines
- Planning & spec structure
- Code standards (pnpm, database, migrations)
- Safety guardrails
- Dev server safety
- Subagent scope control
- Shared components patterns
- Reference links to `.ai/instructions/` detail files

❌ Cannot contain:
- Model-specific advice (Claude vs Gemini)
- MCP tool lists (those are CLI-specific)
- Agent-specific personas

#### CLAUDE.md (Claude-Specific)
✅ Can contain:
- Claude expertise & persona
- MCP tools available to Claude
- Claude-specific workflows
- Cross-references to AGENTS.md ("See AGENTS.md#Code for...")
- Claude model context

❌ Cannot contain:
- General rules (those belong in AGENTS.md)
- Gemini-specific content
- Database rules (reference AGENTS.md instead)

#### GEMINI.md (Gemini-Specific)
✅ Can contain:
- Gemini expertise & persona
- MCP tools available to Gemini
- Gemini-specific workflows
- Cross-references to AGENTS.md
- Gemini model context

❌ Cannot contain:
- General rules (those belong in AGENTS.md)
- Claude-specific content
- Database rules (reference AGENTS.md instead)

### 3. Cross-Reference Format

When referencing another file, use this format:

```markdown
See `AGENTS.md#Code` (lines 123-134) for the full database safety workflow.
```

Or for external files:

```markdown
See `.ai/instructions/database-safety.md` for drift recovery procedures.
```

### 4. Audit Checklist (Run Before Commit)

Before committing changes to AGENTS.md, CLAUDE.md, or GEMINI.md:

- [ ] No rule appears in more than one file (except cross-references)
- [ ] All universal rules are in AGENTS.md
- [ ] CLAUDE.md only contains Claude-specific content
- [ ] GEMINI.md only contains Gemini-specific content
- [ ] Cross-references use the format above
- [ ] No contradictory advice between files
- [ ] File Governance table in AGENTS.md is up-to-date

### 5. Common Mistakes to Avoid

❌ **WRONG**: Repeating the same rule in AGENTS.md and CLAUDE.md
```markdown
# AGENTS.md
- Use pnpm exclusively — never npm or yarn

# CLAUDE.md
- **Always use `pnpm`**: Never use `npm` or `yarn`
```

✅ **RIGHT**: Define once, reference in others
```markdown
# AGENTS.md
- Use `pnpm` exclusively — never `npm` or `yarn`. (line 125)

# CLAUDE.md
For universal code standards including pnpm usage, see `AGENTS.md#Code` (line 125).
```

❌ **WRONG**: Putting model-specific advice in AGENTS.md
```markdown
# AGENTS.md
- Claude should use Playwright MCP first
```

✅ **RIGHT**: Put in model-specific file
```markdown
# CLAUDE.md
- **Browse first**: Use Playwright MCP to view the running app...
```

---

## Maintenance Protocol

**Who**: Any agent or human modifying instruction files.

**When**: Before every commit that changes AGENTS.md, CLAUDE.md, or GEMINI.md.

**How**:
1. Run the audit checklist above
2. Compare your changes against the file hierarchy table
3. Search for duplicated phrasing across files (use grep/regex)
4. Update the File Governance table in AGENTS.md if categories change

**Example workflow**:
```bash
# After editing AGENTS.md, check for conflicts with CLAUDE.md
grep -n "pnpm\|database\|migrate\|Prisma" AGENTS.md CLAUDE.md | sort

# Read both files side-by-side for tone/intent
```

---

## Last Audit

**Date**: 2026-05-24  
**Auditor**: Copilot CLI  
**Result**: ✅ PASS

- Unified database safety in AGENTS.md#Code (lines 127-134)
- Removed duplicates from CLAUDE.md
- Added governance table
- pnpm rule in AGENTS.md, referenced in CLAUDE.md
- MCP tools in CLAUDE.md only
