---
description: Runs the full production build (client install, client build, prisma generate, server typecheck) without committing.
---

# Build

Runs the full production build pipeline. Does **not** commit or push.

## Steps:

// turbo-all

1. Execute `npm install` in `client/` to install client dependencies. If this fails, stop and report the errors.
2. Execute `npm run build` in `client/` to build the client. If this fails, stop and report the errors.
3. Execute `npx prisma generate` in the repo root to generate the Prisma client. If this fails, stop and report the errors.
4. Execute `npx tsc --noEmit` in the repo root to typecheck the server. If this fails, stop and report the errors.
5. Provide a brief summary confirming all build steps passed.
