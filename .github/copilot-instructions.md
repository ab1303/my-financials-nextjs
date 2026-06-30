# Copilot Instructions

All rules — risk tiers, hard constraints, verification gate, session lifecycle, anti-rationalization — live in [`AGENTS.md`](../AGENTS.md). Copilot loads it automatically; this file is intentionally empty of duplicated content.

File-scoped rules live under `.github/instructions/*.instructions.md` and auto-inject when their `applyTo` glob matches the file being edited.
