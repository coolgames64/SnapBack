# GitHub, local use and hosting

## Run the free app

```sh
git clone https://github.com/coolgames64/SnapBack.git
cd SnapBack
npm start
```

Use Node.js 24 and open http://127.0.0.1:4173. The local preview intentionally has no trusted hosted sign-in. Photos/checklists stay in that browser; this repository does not upload a shared photo library to GitHub.

## Build the full application

```sh
npm ci
npm run check
npm test
npm run build
```

This repository includes the Vinext/Sites runtime integration. A clean clone defaults to the portable profile. `.openai/hosting.json` identifies the original Site; it grants no publishing permission. Do not reuse its identity when creating a separate Site.

Production needs trusted Sites sign-in, protected runtime values, a `DB` D1 binding and the `drizzle/` migrations. Hosting elsewhere requires equivalent authentication and storage adapters. GitHub Pages cannot hold private API keys or run the secure AI backend.

## Upload updates remotely

After editing and testing a clone:

```sh
git add .
git diff --cached --stat
git commit -m "Update SnapBack"
git push origin main
```

Authenticate with GitHub CLI/device sign-in or an approved connection that has repository write access. Never put a token in the remote URL, code, README or chat. Resolve upstream changes before pushing; do not force-push.

A push updates GitHub source. It **does not automatically redeploy** the existing Sites app; the Sites publishing workflow is separate. Ask for a site update when a GitHub change should become live. Server secrets stay on the web host, not in repository files.

Subscriptions are deferred. The app has no checkout and needs no payment-provider account. Free AI on the hosted app uses sign-in, consent and shared usage limits. This upload enables no paid hosting plan or CI billing plan.
