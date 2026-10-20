# AI integration

SnapBack retains the server-only Groq Free-plan vision adapter and validated JSON reports. Secrets are excluded from Git. Photos are sent only with explicit user consent; suggestions require review.

The current direct-Klarna setup boundary grants no paid entitlement. AI remains locked in the app until merchant approval, checkout/order verification, recurring billing and cancellation management are implemented. See [Klarna setup](docs/KLARNA.md).

`groq.mjs` uses the pinned vision model, fixed HTTPS endpoint, disabled reasoning, bounded output and no paid fallback. Free quotas and human review still apply. Refer to the main README for limits and privacy details.
