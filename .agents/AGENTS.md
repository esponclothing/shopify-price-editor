# Deployment & Git Rules

1. **NEVER use Git or push to Git for any Vercel apps** (including `checkout-app`, `Shopify-Price-Editor`, or any other backend/app directory). These applications are deployed directly to Vercel via the Vercel CLI (`vercel --prod`) and must never be tracked or pushed to Git repositories to prevent credential leaks.
2. **ONLY the Shopify theme (`11fit theme`) is pushed to GitHub.** Any git commit or git push commands must ONLY ever be executed inside the theme directory (`11fit theme`), and never inside app directories.
3. **DO NOT MODIFY CHECKOUT CODE WITHOUT EXPLICIT PERMISSION.** The checkout integration (`checkout-app` and `11fit theme/assets/whatsapp-checkout.js`) is highly complex and handles sensitive live payment / order creation logic (Cashfree / Shopify). Future agents MUST NOT touch, refactor, or edit these files unless the user explicitly requests it with specific permission.

---

# Critical Business Logic — DO NOT BREAK

The following logic has been hardened and tested. Future agents must **READ AND UNDERSTAND** these rules before touching any related code.

## 1. Store Credit (Wallet) Discount — `checkout-app/src/app/api/checkout/complete/route.ts`

**Rule:** When `wallet_credit_amount > 0`, the system MUST apply an `applied_discount` with `value_type: 'fixed_amount'` to the Shopify Draft Order **before** calling `complete.json`. This is what causes Shopify to correctly reduce the Net Payable amount.
- Simply adding a tag or note is NOT enough — the discount MUST be applied to the draft order.
- This applies to ALL payment methods: `cod`, `prepaid`, and `partial_cod`.
- The discount is applied in the block starting at `// 3. Tag and Note Wallet Credit Usage`.
- **DO NOT remove** the `draftPayload.applied_discount` assignment from this block.

## 2. Order ID Retry Logic — `checkout-app/src/app/api/checkout/complete/route.ts`

**Rule:** After calling Shopify's `complete.json`, the `order_id` may not appear immediately due to Shopify API latency. The code retries up to **3 times with a 1-second delay** before giving up.
- **DO NOT simplify or remove** the retry loop (`while (retryCount < 3 && !gotOrderId)`).
- The frontend relies on `order_id` in the response to display the Order Number popup to the customer.
- If `order_id` is missing, the fallback sets it to `draft_order.id` so the flow doesn't crash.

## 3. Cashfree Transaction Note — `checkout-app/src/app/api/checkout/complete/route.ts`

**Rule:** For `prepaid` orders with a `cashfree_order_id`, the system MUST append the Cashfree Transaction ID to the Shopify order note in the format:
`Paid via Cashfree (Online): ₹{amount} - Transaction ID: {cashfree_order_id}`
- This is done in **two places** for safety: once in the draft PUT before completion, and once in the post-completion order PUT.
- **DO NOT remove either** of these note-append blocks.

## 4. Customer Lookup — `checkout-app/src/app/api/checkout/complete/route.ts`

**Rule:** Customer lookup is done by **phone number** first (formatted as `+91XXXXXXXXXX`). If found, the existing customer ID is linked to the draft. If not found, a new customer object is embedded. **NEVER** pass raw email/phone directly without the existing lookup — it causes Shopify duplicate customer / "email taken" errors on repeat orders.

## 5. Frontend Order Number — `11fit theme/assets/whatsapp-checkout.js`

**Rule:** On success, the backend returns `{ order_id, success }`. The frontend uses `data.order_id` to:
1. Populate `#wa-success-order-val` span
2. Set `#wa-success-order-number` to `display: inline-block`
- If `data.order_id` is falsy, the element stays hidden. This is intentional as a graceful fallback.
- **DO NOT change** how `finishOrderBackend` reads and displays this value.

---

# Summary of Protected Files

| File | Protected Logic |
|------|----------------|
| `checkout-app/src/app/api/checkout/complete/route.ts` | Wallet discount, order ID retry, Cashfree note, customer lookup |
| `checkout-app/src/app/api/checkout/create-payment/route.ts` | Cashfree session creation, wallet deduction from payment amount |
| `checkout-app/src/app/api/checkout/update-draft/route.ts` | Prepaid discount application, partial COD advance tag |
| `11fit theme/assets/whatsapp-checkout.js` | Full checkout flow, success screen order number display |
| `11fit theme/snippets/whatsapp-otp-modal.liquid` | Modal HTML structure, success screen elements |
