# Git Workflow

## First push
```bash
git init
git add .
git commit -m "chore: initialize asoudeh project"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

## Feature
```bash
git checkout -b feature/transactions
git add .
git commit -m "feat: add transaction foundation"
git push -u origin feature/transactions
```

بعد از تست، Pull Request به `develop` یا `main` ایجاد کن.
