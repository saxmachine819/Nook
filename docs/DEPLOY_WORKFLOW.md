# Deploy workflow: feature → staging → production

- **`main`** = production (Vercel production deploys from here).
- **`Staging`** = staging (Vercel staging/preview deploys from here).
- **Feature branches** = where you build (e.g. `feature/your-feature-name`).

## 1. Start a new feature

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

## 2. Work on the feature

Commit and push as usual:

```bash
git add .
git commit -m "Add ..."
git push origin feature/your-feature-name
```

## 3. Deploy to staging

Merge your feature into `Staging` and push (Vercel will deploy staging):

```bash
git checkout Staging
git pull origin Staging
git merge feature/your-feature-name
git push origin Staging
git checkout feature/your-feature-name   # optional: switch back to feature branch
```

## 4. Deploy to production

After testing on staging, merge `Staging` into `main` and push:

```bash
git checkout main
git pull origin main
git merge Staging
git push origin main
```

## Quick reference

| Goal              | Branch to merge into | Then push        |
|-------------------|----------------------|------------------|
| Deploy to staging | `Staging`            | `git push origin Staging` |
| Deploy to prod    | `main`               | `git push origin main`    |
