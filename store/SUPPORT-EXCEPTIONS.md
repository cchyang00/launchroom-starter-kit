# Merrivy support and order exceptions — operating draft

Prepared September 26, 2026 (Central) for checklist E08. This is a product-independent handling procedure; it has not been exercised with a real order, supplier, or test message. Current contact is `support@merrivy.com`. The owner must confirm the supplier return route and the flagged policy choices in [POLICY-DRAFTS.md](POLICY-DRAFTS.md) before this becomes customer-facing policy.

## Each order and support pass

1. A named human operator checks Shopify orders/fulfillment exceptions and the support mailbox. Record the date, order reference, product/variant, country, promised terms, source of the reported problem, and next owner/action in a private order record. Do not copy customer personal details into the OS or Markdown.
2. Compare Shopify payment, available fraud analysis, inventory, shipping address/market and fulfillment status with the chosen supplier's actual acknowledgement. Review payment and risk before supplier dispatch; an unavailable fraud recommendation is not proof of safety or fraud. Keep automatic fulfillment off until the order route is verified. An accepted order is not supplier acceptance; a tracking number is not carrier acceptance or delivery.
3. Confirm the customer-facing statement before responding: actual product, order stage, tracking events, supplier evidence, and the policy version in effect for that order. If facts conflict, mark **investigating**, preserve the contrary evidence and give an accurate status without inventing a delivery date or resolution.
4. Log the action and follow-up owner in the order/support system. Escalate unresolved delivery, payment, privacy, chargeback, and legal questions to the owner. No unattended response or monitoring is assumed.

Use separate views or a private exception list for **new paid/unfulfilled**, **payment or fraud review**, **overdue fulfillment/no carrier acceptance**, and **return/refund/dispute**. An empty Unfulfilled view does not prove all work is closed: inspect payment, return and refund states independently. Keep only an internal order reference, status timestamp, deadline and next owner in OS records; Shopify remains the customer/payment authority. The [order operations research](../resources/research/2026-09-27-order-operations.md) has source links and status limits.

## Exception paths

| Trigger | Verify first | Handling boundary |
| --- | --- | --- |
| New paid order | Product/variant, destination, payment and available fraud state, ship-by promise, supplier order route and stock acknowledgement | If payment/risk review, route or stock is unresolved, hold supplier dispatch and escalate; do not mark fulfilled to clear a queue. |
| Cancellation request | Order payment, supplier acceptance/ship state, carrier handoff and the policy applicable to this order | Confirm whether supplier work can be stopped separately. Record supplier cancellation, Shopify cancellation and refund transaction/status as distinct actions; if shipped, explain the actual return path. Do not promise a cancellation that cannot be completed. |
| Late or missing tracking | Supplier processing proof, carrier acceptance, latest scan, delivery promise and address | Ask supplier/carrier for trace as appropriate; share only a verified update with the customer. A label created without carrier acceptance is not shipped. |
| Promised ship date cannot be met | Original checkout promise, order date, actual supplier/warehouse status, available revised ship date and applicable market rule | Flag before the deadline; assign an authorized operator to issue the required delay choice or prompt refund. Record notice, customer consent/cancellation and refund outcome. For covered US internet orders, follow the [FTC shipment rule](https://www.ftc.gov/business-guidance/resources/business-guide-ftcs-mail-internet-or-telephone-order-merchandise-rule); check other markets separately. |
| Marked delivered but missing | Carrier delivery proof, customer address/notes, supplier/carrier claim route | Escalate the claim and preserve timestamps. Do not assume either theft or customer error. |
| Damage, defect or wrong item | Order SKU, received-item photos, packaging, reported date and supplier policy | Preserve the report, confirm the exact issue, and follow the approved replacement/return/refund path. Current draft asks for a report within seven days; owner review is still open. |
| Return/refund request | Order date, condition/evidence, policy window, return destination, supplier authorization and any dispute | Do not provide an unconfirmed return address. Record request, authorized disposition, Shopify refund submission, provider completion/failure and supplier recovery separately. Escalate an active chargeback; do not issue a second refund from an in-progress label. |
| Failed payment, duplicate charge or chargeback | Shopify payment timeline, processor status, order state and customer report | Do not attempt off-platform collection or disclose payment details. Escalate disputed/duplicate transactions to the owner and payment provider workflow. |
| Privacy or account request | Requester identity through the supported platform process and data location | Do not export or disclose customer data through ordinary email. Escalate to the owner and use the approved Shopify/privacy procedure. |

## Before the first live order

- Name the operator and a backup; set a feasible order/mailbox review cadence and weekend/absence coverage. The owner has not approved or configured unattended monitoring.
- Verify who may cancel, refund, replace, contact the supplier and authorize extra shipping cost. Record the supplier's escalation contact and actual tracking/return route privately.
- Reconcile policy copy, shipping rates/estimates, product page and checkout against the same product-country offer. Test one controlled order and the relevant notification/exception path without charging or dispatching a real order outside the authorized scope.
- A simulated order proves only the configured handoff. An authorized physical supplier test separately records the received exact variant, packaging, supplier acceptance-to-carrier time, tracking events and defect/damage result. Verify the written return policy and Shopify's configured return/cancellation rules as separate settings.
- Keep this checklist E08 **open** until ownership, supplier route, customer-support channel and a rehearsal have been verified.
