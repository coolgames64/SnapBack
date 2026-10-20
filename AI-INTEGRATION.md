# AI integration

SnapBack retains the server-only Groq Free-plan vision adapter and validated JSON reports. Secrets are excluded from Git. Photos are sent only with explicit user consent; suggestions require review.

AI is free within usage limits. The hosted app requires trusted sign-in and fresh photo consent, with no payment or subscription check. `ai-api.mjs` hashes the member identity before reserving D1 quota and calling Groq. It fails closed when credentials or quota storage are missing. Browser flags and locally supplied identity headers do not grant access. The simple local preview cannot authenticate cloud requests.

Configure only `GROQ_API_KEY` as a protected server secret and `GROQ_FREE_PLAN=true`. Keep the provider account on its Free plan. Production requires the existing `DB` binding and migrations. No billing credentials are needed.

`groq.mjs` uses the pinned vision model, fixed HTTPS endpoint, disabled reasoning, bounded output and no paid fallback. Free quotas and human review still apply. Refer to the main README for limits and privacy details.
