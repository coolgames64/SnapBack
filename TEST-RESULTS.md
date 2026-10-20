# Validation — 20 October 2026

Subscriptions are deferred. The app offers free Groq comparison with hosted sign-in, fresh consent and shared quotas. Tests cover disabled legacy payment endpoints, anonymous and cross-origin rejection, configuration failures, validation before quota reservation, quota rejection, hashed member identity and a successful comparison using a mocked provider response. No test creates a payment.

Groq adapter tests cover image validation, bounded JSON, fixed endpoint/model, two images, server-only authorization, output validation and real SQLite quota queries. A real identical-photo Groq comparison succeeded during an earlier release; this release uses deterministic provider fixtures to verify the newly connected endpoint without consuming more shared capacity.

The simple local preview rejects forged identity headers. Existing camera, local library, checklist and slider flows remain available. Physical camera behavior varies by device.

Validation for this release: all 25 automated tests and JavaScript syntax checks passed. The production bundle was built with the Sites packaging helper. Browser fixture scripts were updated for the new free-AI status contract; their earlier camera tests were not rerun in this release.
