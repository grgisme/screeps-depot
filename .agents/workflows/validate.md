---
description: Type-checks server and client, then runs the full production build, without committing.
---

# Validate (Test + Build)

Runs type-checking for both server and client, then executes the full production build. Does **not** commit or push.

## Steps:

// turbo-all

1. Execute `npx tsc --noEmit` in the repo root to typecheck the server. If this fails, stop and report the errors.
2. Execute `npx tsc -b --noEmit` in `client/` to typecheck the client. If this fails, stop and report the errors.
3. Execute `npm install` in `client/` to install client dependencies. If this fails, stop and report the errors.
4. Execute `npm run build` in `client/` to build the client. If this fails, stop and report the errors.
5. Execute `npx prisma generate` in the repo root to generate the Prisma client. If this fails, stop and report the errors.
6. Provide a brief summary confirming all checks and build steps passed.
