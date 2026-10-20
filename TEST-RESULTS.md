# Validation — 20 October 2026

41 automated tests and syntax checks passed for the separate email/password integration. Auth checks cover safe redirects, required project settings, ignored ChatGPT/forged identities, same-origin POST, bounded forms, password validation, confirmation, generic account messages, quotas, reset callbacks, server-verified identity, secure cookie headers and sign-out. A test exercises the actual Supabase SSR SDK with an isolated Auth-server fixture; other account tests isolate failures with fake SDK responses. No test sends real email or creates a real account.

Browser checks verify sign-in, account creation and reset modes, pending-setup messaging, disabled credential fields before configuration and mobile layout. The prior upload/save/reload check remains valid; photo storage and camera code are unchanged apart from the AI account-status message.

The production build uses Sites packaging. **Real registration, email delivery, reset and authenticated AI remain unverified until dashboard URL/email configuration is completed and the ready flag is enabled.** Published forms must not be described as activated while setup is pending. Groq previously completed a real identical-photo comparison; this release uses deterministic fixtures.
