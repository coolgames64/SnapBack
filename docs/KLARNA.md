# Direct Klarna setup — without Stripe

The current app has an explicit, locked payment boundary. It does not create real Klarna sessions or grant Plus access. Merchant credentials, approval and a complete recurring billing backend are required before activation.

## Merchant setup

1. Start with [Klarna's direct integration checklist](https://docs.klarna.com/acquirer/klarna/get-started/integration-checklist/).
2. Create a Klarna business merchant/test account. A shopper account is not enough.
3. Confirm with Klarna that your digital subscription business, UK/GBP market and recurring-payment use case are enabled.
4. Generate separate Playground credentials in the merchant portal. Keep the API username/password on the server; do not put them in GitHub or chat.
5. Complete the integration and Playground testing before requesting production activation and accepting merchant terms yourself.

Klarna merchant pricing and approval are separate from the Groq Free plan. This repository does not sign an agreement, create a merchant account, activate live payments or promise fee-free payment processing.

## Required backend work

For a paid monthly signup, Klarna documents a payment session with `intent=buy_and_tokenize`, a subscription object on the order lines, customer authorization, order creation and customer-token creation. The server must verify the resulting order and associate it with the authenticated member. A redirect or browser flag must never unlock AI.

For renewal, **your backend schedules billing**: read the saved customer token and create a new order for the next billing period with a stable idempotency key. Store the paid period, reconcile capture, handle declined/failed renewals, and implement customer cancellation. Use verified server-side order/token state for entitlements. Do not mark a period paid from a frontend callback alone.

Implement protected token/order storage, tax/price validation, authenticated callbacks, replay protection, reconciliation and recovery before enabling the checkout button. Do not expose merchant credentials in the browser. Review Klarna's required consent, billing cadence and cancellation presentation with the merchant account owner.

## Planned SnapBack plan

- £4.99 GBP per month, quantity one, no trial.
- Free local photo/camera/checklist tools remain free.
- Plus AI requires a verified paid period; it remains locked until implemented.
- Payment options offered by Klarna depend on merchant, customer and market eligibility. Do not advertise instalments or deferred payment as guaranteed.

## Official documentation

- [Direct integration checklist](https://docs.klarna.com/acquirer/klarna/get-started/integration-checklist/)
- [Payments API](https://docs.klarna.com/api/payments/)
- [Customer tokens](https://docs.klarna.com/acquirer/klarna/web-payments/integrate-with-klarna-payments/tokenized-payments/customer-token/)
- [Charge subscription renewals](https://docs.klarna.com/acquirer/klarna/web-payments/integrate-with-klarna-payments/tokenized-payments/charge-a-subscription/)
