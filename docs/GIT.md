# Git workflow

The repository is already initialized. Do not repeat the initialization or remote setup instructions from older project templates.

## Focused change

1. Check the current branch and working tree; preserve existing local changes.
2. Create a focused branch from the maintained project branch, for example `feature/transaction-filters` or `fix/session-refresh`.
3. Make the smallest change that addresses the issue and run the relevant tests, lint, and typecheck.
4. Review the complete diff and stage only the intended files. Avoid `git add .` because it may include unrelated files, generated output, or local configuration.
5. Open a Pull Request against the repository's maintained default branch. Include the problem, implementation, tests, and any deployment/migration notes.

## Safe review commands

```powershell
git status --short
git diff --check
git diff
git add -- path\to\file1 path\to\file2
git diff --cached --check
git diff --cached --stat
git diff --cached
```

Never stage `.env` files, credentials, local database dumps, generated build output, or unrelated worktree changes.
