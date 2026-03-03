---
description: Validates the build (server + client typecheck), then stages, commits, and pushes.
---

# Validate and Sync

Runs all type checks and build validation before committing and pushing.

## Steps:

// turbo-all

1. Execute `npx tsc --noEmit` in the repo root to typecheck the server. If this fails, stop and report the errors.
2. Execute `npx tsc -b` in `client/` to typecheck the client. If this fails, stop and report the errors.
3. Execute `npx vite build` in `client/` to validate the client production build. If this fails, stop and report the errors.
4. Execute `git add .` in the repo root to stage all changes.
5. Analyze the staged diff and generate a concise, conventional commit message (e.g., feat:, fix:, refactor:).
6. Execute `git commit -m "<your generated message>"` in the repo root.
7. Execute `git push` in the repo root to push to the remote branch.
8. Provide a brief summary confirming all checks passed, the commit message used, and that the push was successful.
