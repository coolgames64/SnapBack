# SnapBack

[Open the app](https://snapback-setup-library.etant.chatgpt.site/) · [Hosting and remote updates](docs/HOSTING.md)

Mobile-friendly photo setup library with a built-in camera, uploads, locally saved references, before/after slider, editable checklists and a server-only Groq vision adapter.

## Run locally

Use Node.js 24:

```sh
npm ci
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

The existing full app is hosted on Sites. It depends on trusted sign-in and D1 storage. GitHub stores the source; GitHub Pages alone cannot run the AI backend. See the hosting guide before deploying elsewhere.

## Sign-in and your own uploads

Open `/login` for separate email/password accounts secured by Supabase. Sign-in, account creation, email verification, reset emails, password updates and browser sign-out are implemented with the official `@supabase/ssr` SDK. ChatGPT identity headers no longer authenticate an email account. **Activation requires the owner's Supabase project and email-delivery setup; until configured, forms are disabled with an honest setup message.** See [account setup](docs/EMAIL-ACCOUNTS.md).

The server verifies identity with Supabase's Auth server before AI access. Cookies are HttpOnly, Secure on HTTPS, SameSite=Lax and never cached. Passwords and tokens are never returned to browser scripts or stored in the photo library. Account actions require same-origin requests, bounded JSON, provider validation and hashed-email usage counters in D1. Local preview ignores identity headers and also requires the configured backend and D1 binding for account activation.

Use **Upload photo** in the library header, or drop an image onto the welcome strip. Choose an image, review its preview, name the setup, then save. Camera capture and current/reference replacement remain available. Uploads do not require sign-in and stay in this browser. Signing in or out does not move, sync, isolate or erase the device's existing library; use separate browser profiles for separate local libraries.

## No subscriptions

SnapBack currently has no checkout, subscription, price or payment provider. All legacy payment endpoints return `410 PAYMENTS_DISABLED`. Historical database migrations remain unchanged for existing installations; their old billing table is unused.

## AI: Groq Free plan

The server-only `groq.mjs` adapter uses `qwen/qwen3.8-27b`. A real comparison of identical bundled photos succeeded during development. It requests JSON, validates results and rejects incomplete reports. Keys belong only in protected server settings (`GROQ_API_KEY`, `GROQ_FREE_PLAN=true`); none are included here. Keep Groq on Free and do not enable paid Developer billing.

Only the two selected resized photos are sent to Groq after fresh consent. SnapBack does not store photos or reports server-side. Groq has its own [data policy](https://console.groq.com/docs/your-data). AI is free within usage limits. Sign in with a verified SnapBack email account before comparing; no subscription or payment details are required. AI remains unavailable until account setup and quota storage are configured.

The adapter has no Google or paid-provider fallback. Application usage counters enforce shared one-minute spacing, 25 daily attempts across the app, 100 attempts per member/month and 1,000 service attempts/month, using UTC periods. Provider limits can stop requests earlier. Failed provider attempts count. All findings require human review; AI cannot certify safety or a complete inventory.

## Source

`client/` contains the library, camera and comparison UI. `server.mjs` is the dependency-free preview. `ai-api.mjs` handles free AI, trusted authentication and quota enforcement. `groq.mjs` validates vision requests/results. `app/`, `build/` and `scripts/` retain Sites/Vinext hosting integration. `db/` and `drizzle/` contain schema and migrations.

Bundled example photos: [coffee](https://images.unsplash.com/photo-1442512595331-e89e73853f31), [workspace](https://images.unsplash.com/photo-1497215728101-856f4ea42174), [living room](https://images.unsplash.com/photo-1600210492486-724fe5c67fb0), under the [Unsplash licence](https://unsplash.com/license).
