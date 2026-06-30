# Capsule Format Scripts

These scripts generate `spec/{domain}/{feature}/capsule.md` from `spec/index.json`, each feature's `context.md`, and any optional `capsule.yml` overrides. The generator also measures the rendered output with the shared tokenizer contract and fails any feature that exceeds the 800-token budget. Use this when you need a deterministic, regenerable feature capsule for subagents. For the full format and workflow details, see `spec/harness/capsule-format/lld.md`.
