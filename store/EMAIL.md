# Zoho support email

Updated 2026-09-15. **support@merrivy.com is created on Zoho Mail Free.** Shopify manages the purchased merrivy.com domain. Zoho verifies MX, SPF and DKIM; Shopify sender is Authenticated. External incoming mail verified through receipt of Shopify's sender-verification email. Owner-only outgoing/reply test remains a draft awaiting send approval.

## Current handoff

- **support@merrivy.com created** after explicit approval; user ID **939278316**, visible in Zoho Users list and active (Inactivate action available). First mailbox is the organization's Super Administrator login. Customer-facing outgoing display **Merrivy Support** saved and read back in Mail Settings → Send Mail As. Actual account/user identity remains Cha Yang.
- Owner/browser activity advanced Zoho from signup to signed-in Email Setup (Cha Yang profile) on the free-plan route. Added merrivy.com, organization Merrivy, industry Retail & E-Commerce. Retrieved exact Zoho TXT via UI, saved it at Shopify root and verified ownership successfully in Zoho. Token stays out of project records.
- Completed Zoho setup wizard after user approval and mailbox creation; skipped extra users, groups, migration and mobile installation. Wizard completion alone does not prove mail delivery. Existing/new-account question is resolved by live signed-in setup progress.
- [Official pricing](https://www.zoho.com/mail/zohomail-pricing.html): free plan includes one domain, up to five users, 5 GB/user; IMAP/POP/ActiveSync excluded and availability limited to selected data centers. Live page offers free signup; final organization eligibility remains unverified.
- Actual admin dashboard plan is **Mail Free**. Paid fallback Mail Lite 5 GB was quoted $1/user/month billed annually ($12/user/year before taxes), not selected or purchased.
- Saved exact Zoho-provided records in Shopify DNS and read them back: root MX mx.zoho.com priority 10, mx2.zoho.com priority 20, mx3.zoho.com priority 50; root TXT v=spf1 include:zohomail.com ~all; TXT zmail._domainkey with the console's public DKIM value. Preserved Shopify website records, _provider, and default _dmarc v=DMARC1; p=none. Ownership TXT also retained.
- Initial Verify all records propagation notice resolved through individual admin checks: MX page says records point to Zoho; SPF says records pointed successfully; verified zmail DKIM selector ID **1082700000324591905**, then confirmed domain DKIM Status enabled and selector Verified. Do not rely on icon-only wizard status.
- Inbox accessible at https://mail.zoho.com/zm/. Shopify verification email from mailer@shopify.com arrived at support inbox; opened its link after verifying host matches ndfdtc-br.myshopify.com. Shopify now saves support@merrivy.com in Settings → Notifications and reports **Email domain authentication Status: Authenticated**. Unverified-email warning cleared.
- Draft prepared for owner's Gmail: subject **Merrivy support email setup test**; short body explains delivery/sender/reply test. Requested permission to send it, inspect Gmail and reply **Reply test received** back to Zoho. No test message sent yet. Customer-facing store still password protected.

## Current completion limits

Domain purchase, primary HTTPS storefront, mailbox access, incoming Shopify verification email, Zoho DNS authentication and Shopify sender authentication are verified. Outgoing delivery, reply receipt and actual delivered-message SPF/DKIM/DMARC headers still need the approved round-trip test. No paid email plan, MCP, automation or customer message enabled.

## Setup procedure and completion criteria

1. Record accepted store name and verify exact Shopify domain checkout terms. Domain acquisition needs final purchase confirmation; an available search result is not domain ownership. The earlier IONOS checkout is superseded and must remain unsubmitted.
2. Reuse an owner-controlled Zoho account when available. Otherwise prepare registration using the owner's chosen recovery identity; keep credentials/OTP outside project records. Inspect final plan, region and signup details before submission. Complete required account verification through the supported UI.
3. Add the owned domain to Zoho. Use the verification record supplied by this organization's console in the actual authoritative DNS provider. Completion: Zoho reports domain ownership verified.
4. Create the support mailbox and record its address and admin ownership. Avoid creating unrelated aliases or additional billable users by default. Completion: mailbox accessible in Zoho.
5. Inspect current DNS first. Apply the exact region-specific MX, SPF and DKIM values supplied by Zoho, preserving Shopify website records and unrelated services. Maintain one combined SPF policy, not competing SPF records. Configure an appropriate DMARC policy after checking all legitimate senders; do not invent a report inbox or enforce rejection before validation. Completion: Zoho console verifies delivery/authentication records. See [delivery guide](https://www.zoho.com/mail/help/adminconsole/configure-email-delivery.html).
6. Verify incoming mail and a reply using an owner-designated test address with permission to send the test. Inspect authentication and reply identity. Completion: both directions received, no bounce, correct From/Reply-To; DNS success alone is incomplete.
7. Set Shopify support/contact and notification sender fields deliberately. Check Shopify's separate sender-domain authentication requirements; Zoho mailbox setup alone does not authenticate Shopify notifications. Completion: customer contact links reach the working mailbox and Shopify shows the intended verified sender configuration.
8. Record final plan/renewal, safe domain/mailbox IDs, verification date and remaining gaps here; update STATE. Keep passwords, verification tokens, keys, message contents and private customer data out of Markdown.

## Automation opportunity — proposed

[Zoho Mail MCP](https://www.zoho.com/mail/help/mcp/getting-started.html) and its [configuration guide](https://www.zoho.com/mail/help/mcp/mcp-server-configuration.html) provide an official route for mailbox and admin tools. No Zoho MCP is currently callable in this session. After the mailbox works, verify account/plan eligibility and available connector scopes. Start with reading, labeling and drafting support replies; external sending still needs the owner's explicit authorization. Measure time per ticket and draft corrections before expanding automation. No connector, workflow or unattended customer messaging has been activated.
