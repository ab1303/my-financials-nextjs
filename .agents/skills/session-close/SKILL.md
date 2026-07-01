---
name: session-close
description: >
  Automates the deterministic session-end ritual: runs the Verification Gate
  (type-check, lint, spec:check), updates feature-status.json, rotates
  progress.md, stamps lastVerifiedSha, stages harness files, and presents the
  git commit command for user confirmation. Use when the user says "close the
  session", "wrap up", "end of session", "do a session close", "session
  handoff", or "finish up". Triggers on: "close session", "wrap up the
  session", "session close", "end session", "handoff", "finish the session".
metadata:
  author: local
  version: '1.0.0'
  argument-hint: [--feature <id>]
---

# Session Close

Runs the full session-end ritual via `close.mjs`, then guides the agent through
the one human-judgment step (filling the narrative) before presenting the commit
command for user confirmation.

---

## Steps

### Step 1 — Run close.mjs

```
node scripts/harness/session-close/close.mjs [--feature <id>]
```

- If the user specified a feature id, pass `--feature <id>`.
- If no feature is specified and there is only one `in-progress` feature, omit the flag.
- If there are **multiple** `in-progress` features, ask the user which one to close before running.

Capture and print the full output.

### Step 2 — Report gate results

After running, print a concise summary:

```
Gate results:
  type-check : ✅ / ❌
  lint       : ✅ / ❌
  spec:check : ✅ / ❌  (drift=N overlap=N ghost=N)
```

If **any gate failed** (exit code 1):
- List which verification items are still failing.
- Tell the user what to fix before the session can be fully closed.
- **Stop here** — do not write narrative or present a commit command until gates pass.

### Step 3 — Fill the narrative (judgment required)

Open `.harness/progress.md`. Locate the `<!-- narrative -->` and `<!-- Agent: ... -->` placeholder blocks:

- **`### What was done`** — replace or extend the notes with a 2–4 sentence plain-English summary of what actually changed this session (files created/modified, decisions made, problems solved).
- **`### Next up`** — replace the placeholder with the concrete next workstream (feature id + first action), based on the planned features list already printed in the file.
- **`### Next session starts at`** — fill in the specific file + section or command the next session should pick up from.

Keep each block to ≤5 lines. Do not remove the verification table or open-items section.

### Step 4 — Present commit command

Print the exact commit command for the user to confirm and run:

```
git commit -m "harness: session close <date> — <feature-id> (<status>)"
```

- **Never run `git commit` yourself.** Per `AGENTS.md` Hard Constraint: every commit requires explicit user confirmation.
- Remind the user the harness files are already staged (`git add` was called by `close.mjs`).

### Step 5 — Done

After presenting the commit command, announce:

> "Session close complete. Run the commit command above to finish. You can then `/clear` or `ctrl+c×2` to end the session."
