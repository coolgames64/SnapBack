# SnapBack

[Open the app](https://snapback-setup-library.etant.chatgpt.site/) · [Direct Klarna setup](docs/KLARNA.md) · [Hosting and remote updates](docs/HOSTING.md)

Mobile-friendly photo setup library with a built-in camera, uploads, locally saved references, before/after slider, editable checklists and a server-only Groq vision adapter.

## Run locally

Use Node.js 24:

```sh
npm start
```

Open http://127.0.0.1:4173. Photos and checklists are saved in this browser using IndexedDB. Use Backup & storage to export them before clearing browser data. Camera access needs HTTPS or localhost and permission. Uploads support browser-readable JPG, PNG and WebP; HEIC depends on browser support. No audio is recorded.

## Build and verify

```sh
npm ci
npm run check
npm test
npm run build
```

The existing full app is hosted on Sites. It depends on trusted sign-in and D1 storage. GitHub stores the source; GitHub Pages alone cannot run the payment/AI backend. See the hosting guide before deploying elsewhere.

## Payments: direct Klarna, no Stripe

Stripe checkout has been removed. The planned Plus price is £4.99/month. **Direct Klarna onboarding and the recurring billing backend are not complete, so payment and paid AI access are deliberately locked.** No placeholder button creates a real payment or pretends a subscription is active.

Direct Klarna needs a merchant account, approved payment capabilities, Playground credentials, verified checkout/order handling, customer-token storage, a renewal scheduler, failure recovery and cancellation management. Adding credentials alone will not enable payments. See docs/KLARNA.md.

The old D1 billing table remains in immutable historical migrations, but the current app never uses it to grant access and makes no Stripe API requests. Prior Stripe test setup is not carried into this repository's runtime configuration.

## AI: Groq Free plan

The server-only `groq.mjs` adapter uses `qwen/qwen3.8-27b`. A real comparison of identical bundled photos succeeded during development. It requests JSON, validates results and rejects incomplete reports. Keys belong only in protected server settings (`GROQ_API_KEY`, `GROQ_FREE_PLAN=true`); none are included here. Keep Groq on Free and do not enable paid Developer billing.

Only the two selected resized photos are sent to Groq after fresh consent. SnapBack does not store photos or reports server-side. Groq has its own [data policy](https://console.groq.com/docs/your-data). The paid feature remains locked until direct Klarna entitlement verification is implemented; no browser flag bypasses this.

The adapter has no Google or paid-provider fallback. Application usage counters enforce shared one-minute spacing, 25 daily attempts across the app, 100 attempts per member/month and 1,000 service attempts/month, using UTC periods. Provider limits can stop requests earlier. Failed provider attempts count. All findings require human review; AI cannot certify safety or a complete inventory.

## Source

`client/` contains the library, camera and comparison UI. `server.mjs` is the dependency-free preview. `billing.mjs` is the explicit locked Klarna setup boundary. `groq.mjs` validates vision requests/results. `app/`, `build/` and `scripts/` retain Sites/Vinext hosting integration. `db/` and `drizzle/` contain schema and migrations.

Bundled example photos: [coffee](https://images.unsplash.com/photo-1442512595331-e89e73853f31), [workspace](https://images.unsplash.com/photo-1497215728101-856f4ea42174), [living room](https://images.unsplash.com/photo-1600210492486-724fe5c67fb0), under the [Unsplash licence](https://unsplash.com/license).
