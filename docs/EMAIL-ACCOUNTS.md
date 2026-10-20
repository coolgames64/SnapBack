# Separate SnapBack email accounts

The integration uses official Supabase Auth, not a homemade password database. It is implemented but stays disabled until the project settings and D1 quota binding are present. Supabase is connected. The separate SnapBack project is `ihpixhpjaeaeiarswtec`, in London (`eu-west-2`), under coolgames64’s Org. Supabase quoted $0/month when created. No paid plan was enabled. Project URL and the publishable key are saved in protected Sites runtime settings. Confirmation URLs and public email delivery still require dashboard setup; no real user registration or reset email has been tested.

## Owner setup

1. The SnapBack Supabase project has already been created on the Free plan. Use the project above; do not create a duplicate. For a separate deployment, connect Supabase in Codex or create your own Free-plan project. Do not enable a paid plan for this task. Creating an account/project may require the owner to accept terms and choose a database password themselves.
2. In the project's Connect dialog, find its HTTPS project URL and **publishable** key (`sb_publishable_…`). Configure protected SnapBack runtime settings `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. No database password, service-role key or Supabase management token belongs in SnapBack source or chat. Legacy anon JWT keys/custom project domains are not enabled by this adapter.
3. Enable Email/password and email confirmations in Supabase Auth. Configure Site URL as `https://snapback-setup-library.etant.chatgpt.site` and allow the exact callback path `https://snapback-setup-library.etant.chatgpt.site/auth/complete` with its query parameters. Development callbacks need a separate localhost allowlist entry.
4. Configure email delivery for public registrations and password resets. The built-in Supabase mail service is for testing, with restrictive recipient/rate limits; production requires a suitable SMTP provider. Keep email confirmation enabled. Do not promise unrestricted free email delivery.
5. Preserve the existing Sites `DB` D1 binding and migrations. Auth attempts use the existing `ai_usage` table, with `auth:`-prefixed hashed email counters: eight attempts per email per 15-minute UTC bucket, plus 200 shared attempts per bucket. Failed requests count. Supabase's own limits also apply. No additional D1 migration is needed.
6. After verifying the URL/email configuration, set `SUPABASE_AUTH_READY=true` in protected runtime settings and publish the configured source. Keys alone never activate the forms. Test creating an owner-controlled account, confirming its email, signing in, requesting a reset, changing the password and signing out. Confirmation/reset links must open in the browser that requested them because they use PKCE. Never disable confirmation to make a demo look successful.

## Runtime behavior

The server uses `createServerClient` from `@supabase/ssr`, secure HttpOnly cookies and fresh `getUser()` verification. It forwards cookie refresh headers to every response and marks authenticated responses private/no-store. Requests to `/api/auth/signin`, `signup`, `reset`, `update` and `signout` use same-origin POST. `/auth/complete` exchanges the PKCE code; Sites' reserved `/callback` route is preserved. All account return paths are restricted to the library.

ChatGPT/Sites authentication remains platform-owned, but its headers do not grant an email-account session or AI access. Supabase owns password hashing and account recovery. SnapBack does not create its own session-signing scheme or log credentials.

Photo uploads remain available without an account and stay in the browser's existing library. Accounts do not currently synchronise or segregate that local photo library. Separate browser profiles are needed for separate local libraries. Export a backup before clearing browser storage.

## Sources

- [Password authentication and email-delivery requirements](https://supabase.com/docs/guides/auth/passwords)
- [Server-side cookie clients and verified identity](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [PKCE and cache considerations](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [API key types](https://supabase.com/docs/guides/api/api-keys)
