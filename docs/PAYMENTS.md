# Payments

## The rules the code enforces

- **Every payment method starts disabled.** None of them shows at checkout until the owner turns it on.
- **A method can't be turned on until its required details are entered.** The server refuses to enable it, and checkout re-checks the details on every order.
- **A new order is never "Paid".** It starts as *Unpaid* (cash) or *Awaiting payment* (transfers).
- **A customer saying they paid is not proof of payment.** When a customer enters a transfer reference, the order moves to *Payment under review*, never to *Paid*.
- **Only staff with the "verify payments" permission can mark a payment as received.** Owners and administrators have it; the Staff role doesn't. Each verification records who did it and when, and appears in the order history and the activity log.
- **Payment status is separate from order (fulfillment) status.** An order can be *Delivered* while still *Unpaid* (cash on delivery), or *Paid* while still *Preparing*.

## Payment methods

Configure methods in **Dashboard → Payments**.

| Method | Required before it can be enabled | Starts the order as | Who confirms it |
|---|---|---|---|
| **Cash on delivery / pay at pickup** | A name | Unpaid | Staff, after collecting the cash |
| **Whish Money (manual transfer)** | Account holder name, Whish account or phone number, customer instructions | Awaiting payment | Staff, after seeing the money arrive in the Whish account |
| **Bank transfer (manual)** | Customer instructions (bank fields are optional) | Awaiting payment | Staff, after seeing the money arrive in the bank account |
| **Online gateway** | An installed, official provider integration (a developer task) | Awaiting payment | The provider, confirmed server to server |

Options for each method:
- the name and description shown at checkout
- delivery and/or pickup
- minimum or maximum order total
- whether customers can submit a transfer reference
- display order

You can add more manual methods (for example a second bank, or another money-transfer service) with **Add payment method → Manual payment**.

## Payment statuses

| Status | Meaning | What usually happens next |
|---|---|---|
| **Unpaid** | Cash on delivery or pickup; nothing collected yet | Staff mark it as received once the cash is in hand |
| **Awaiting payment** | The customer has been asked to transfer the money | The customer transfers and submits a reference, or staff verify it directly |
| **Payment under review** | The customer says they paid and entered a reference | Staff check the Whish app or bank, then **verify** or **reject** |
| **Paid** | Staff confirmed the money arrived | Fulfil the order |
| **Partially refunded** / **Refunded** | Staff recorded a refund | — |
| **Voided** | The order was cancelled before any payment | — |

## The Whish Money workflow (manual)

### Setting it up

1. Go to **Dashboard → Payments → Whish Money**.
2. Enter:
   - the **account holder name**
   - the **Whish account or phone number** customers will send money to. Double-check it, because customers copy it exactly.
   - **instructions**, for example "Open the Whish app → Send money → enter the number above and the exact order total. Then come back to your order page and enter the transaction reference."
   - optionally, a currency note
3. Choose whether it's offered for delivery, pickup or both. Leave **Customers can enter a transfer reference** on.
4. Turn on **Enabled** and save. If any required detail is missing, the dashboard lists it and refuses to enable the method.

### What the customer sees

1. At checkout they choose Whish Money and place the order. The order status is **Pending** and the payment status is **Awaiting payment**.
2. The confirmation page and the confirmation email show the Whish details, the exact amount and the order number. They say clearly that the order is **not paid yet**.
3. The customer sends the money in the Whish app. Back on their order page (from the email link or their account), they enter the **transaction reference** and an optional note.
4. The order moves to **Payment under review**, and the page says the store will confirm once it has checked.

### What staff do

1. **Dashboard → Orders**, or the **Payments to verify** tile on the dashboard, lists orders under review.
2. Open the order. It shows the reference and the amount expected.
3. Open the **Whish app or statement** and look for the incoming transfer: matching amount, matching reference or sender.
4. Then do one of the following:
   - **Verify payment:** the order becomes **Paid**, the customer gets a "payment received" email, and the order history records your name and the time.
   - **Reject:** use this if no matching transfer arrived. Write a reason (it's emailed to the customer). The order goes back to **Awaiting payment** so the customer can try again.
5. Never verify a payment from a screenshot or a message alone. Check that the money is actually in the account.

If a customer pays but doesn't enter a reference, staff can still verify from the order page, optionally typing the reference they found.

### Why Whish isn't automatic

Whish (spelled *Whish*, the Lebanese payments company behind Whish Money) does offer a merchant checkout product, **Whish Pay**:
- When this store was built, the official integration Whish published was a **Shopify app** (publisher: WHISH SAL).
- No public API documentation for custom-built websites was found.
- The only other integrations found were **unofficial** third-party packages. One states it is "not affiliated with, endorsed by, or maintained by Whish Money", and another routes payments through a separate intermediary service.

This store follows the rule of using only official integrations with real credentials, so it doesn't use those packages, and no Whish API code, credentials or account numbers are included. Customers pay through the clearly labelled manual workflow above.

To get automatic Whish payments later:
1. Ask Whish (merchant or business support) for **official API documentation and merchant credentials** for a custom website, including a **sandbox**.
2. Have a developer add it as a provider, as described in the next section.
3. Test it in the sandbox, then enable it as a separate **Online gateway** method. You can keep the manual Whish method as an alternative or disable it.

## Cash on delivery

The order starts as **Unpaid**. After delivery or pickup, staff open the order and choose **Mark payment received**, which records a verified payment. Analytics count it as a completed sale only from that moment.

## Refunds and cancellations

- **Cancelling an order** before payment:
  - voids the payment status
  - returns reserved stock to inventory (exactly once)
  - releases the discount code use
- **Refunds** are recorded on paid orders under **Record refund**, with an amount and a note. A partial refund sets the order to *Partially refunded*; refunding the full amount sets it to *Refunded*. The store can't send money itself, so return it through Whish, cash or the bank, then record it. Refunds can't exceed what was paid.
- Customers can **request** cancellation from their order page while the order is *Pending* or *Confirmed*. Staff decide.

## Analytics

The dashboard keeps these separate:

| Figure | What it counts |
|---|---|
| **Gross order value** | All non-cancelled orders placed in the period, paid or not |
| **Completed sales** | Orders whose payment is verified (*Paid* or *Partially refunded*), minus refunds |
| **Unpaid / awaiting** | Outstanding amounts: *Unpaid*, *Awaiting payment* and *Under review* |
| **Refunds** | Refunds recorded in the period |

## Audit trail

- Every payment action creates a **Payment record**: amount, method, reference, status, reviewer name and time, notes.
- It also creates an **order history event**, plus an **activity log** entry for staff actions.
- Records are never deleted when an order is cancelled.
- Payment details shown to the customer are **snapshotted on the order** when it's placed. If you change the Whish number later, existing orders still show the details the customer was given.

---

## Adding an online payment gateway later

This section is a developer task. The extension point is `src/lib/payments/providers/index.ts`.

1. **Get official access:** merchant agreement, API documentation, sandbox and live credentials. Don't use unofficial wrappers.
2. **Implement a provider.** Create `src/lib/payments/providers/<name>.ts` that implements `PaymentProvider`:
   ```ts
   export const examplePay: PaymentProvider = {
     key: "example-pay",                 // stored on PaymentMethod.provider
     label: "ExamplePay",
     requiredEnv: ["EXAMPLEPAY_API_KEY", "EXAMPLEPAY_WEBHOOK_SECRET"],
     async createPayment(input) {
       // Call the provider's official API to create a payment session for
       // input.amount (minor units) and input.currency; return its redirect URL.
     },
     async verifyCallback(request) {
       // Verify the webhook SIGNATURE with EXAMPLEPAY_WEBHOOK_SECRET, or fetch
       // the payment status from the provider's API. Return null if invalid.
     },
   };
   ```
   Then add it to the `providers` array. A provider counts as installed only when all its `requiredEnv` variables are set.
3. **Add the routes:**
   - **Redirect step.** After `placeOrder` succeeds for a gateway method, call `createPayment` and redirect the customer to the returned URL. The return URL is the order page.
   - **Webhook.** Create `src/app/api/payments/<key>/webhook/route.ts`. It calls `verifyCallback`, and if the result is `succeeded`, calls `markPaidFromGateway()` from `src/lib/orders/service.ts`. That function only marks the order paid when the confirmed amount and currency **exactly match** the order total. It's idempotent per provider reference, writes the history and audit entries, and leaves an internal note on any mismatch.
4. **Never mark an order paid from the browser redirect alone.** The redirect only tells the customer to come back; the webhook or status API is the proof.
5. **Keep credentials in environment variables only**, never in the database, code or `NEXT_PUBLIC_*` variables. Add the provider's script and frame origins to the CSP in `src/proxy.ts` if its checkout runs embedded.
6. **Test** with the provider's sandbox: success, failure, duplicate webhook, wrong amount and cancelled order. Integration tests for `markPaidFromGateway` already exist in `tests/integration/orders.test.ts`.
7. **Enable it** in **Dashboard → Payments → Add payment method → Online payment gateway**. Choose the provider; the dashboard won't enable it until the provider is installed.
