# Validation — 20 October 2026

This GitHub edition removes Stripe checkout and uses a locked direct-Klarna setup boundary. Its tests verify that status never claims an active subscription, anonymous/cross-origin requests are rejected and checkout/portal/confirmation/AI remain unavailable until merchant setup and the recurring backend are implemented.

Groq adapter tests cover photo validation, bounded JSON, fixed endpoint/model, two images, server-only authorization, output validation and actual SQLite quota queries. The prior Groq adapter completed a real identical-photo comparison; no new Klarna payment or live charge was created. No Klarna end-to-end test is possible without merchant credentials and implementation.

The preceding release's photo-library/camera tests remain core-flow evidence. Browser test mocks are isolated fixtures and not production entitlements. Physical camera behavior varies by device. This edition must not be described as live Klarna billing.
