---
description: Type-checks the server and client without building or committing.
---

# Test (Type-check)

Runs type-checking for the server and the client. Does **not** build, commit, or push.

## Steps:

// turbo-all

1. Execute `npx tsc --noEmit` in the repo root to typecheck the server. If this fails, stop and report the errors.
2. Execute `npx tsc -b --noEmit` in `client/` to typecheck the client. If this fails, stop and report the errors.
3. Provide a brief summary confirming all type checks passed.
