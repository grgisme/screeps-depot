# Agent Rules — screeps-depot

## PowerShell Terminal Rules
- ALWAYS use PowerShell.
- NEVER append `2>&1`, `2>$null`, or other redirection pipes to commands, as this causes terminal deadlocks and breaks permission matching.
- NEVER chain commands using semicolons (`;`), `&&`, or inline logic (e.g., `if` statements). Run one simple, single command at a time.
- ALWAYS execute commands directly (e.g., exactly `npm test` or `npm run build`) without wrapping them in interactive shells or custom error-handling wrappers.

## Workflow Usage
When you need to validate, build, or test the project, **always use the provided workflows** instead of manually issuing commands. This guarantees the correct steps run in the correct order without requiring user input.

| Task | Workflow | Slash Command |
|------|----------|---------------|
| Type-check only (server + client) | `/test` | `.agents/workflows/test.md` |
| Full production build (client + prisma + server) | `/build` | `.agents/workflows/build.md` |
| Type-check **and** build | `/validate` | `.agents/workflows/validate.md` |
| Validate, commit, and push | `/validate-and-sync` | `.agents/workflows/validate-and-sync.md` |
| Commit and push (no validation) | `/git-sync` | `.agents/workflows/git-sync.md` |
