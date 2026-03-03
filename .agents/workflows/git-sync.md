---
description: Stages all changes, writes a semantic commit message based on the diff, and pushes to the remote repository.
---

# Git Sync
Description: Stages all changes, writes a semantic commit message based on the diff, and pushes to the remote repository.

## Steps:
1. Execute `git add .` in the terminal to stage all current changes.
2. Analyze the staged changes and generate a concise, conventional commit message (e.g., feat:, fix:, refactor:, etc.).
3. Execute `git commit -m "<your generated message>"` in the terminal.
4. Execute `git push` in the terminal to push the changes to your remote branch.
5. Provide a brief summary in the chat confirming the commit message used and that the push was successful.