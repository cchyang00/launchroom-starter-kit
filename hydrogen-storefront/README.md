# Merrivy storefront

Owner-selected custom Shopify Hydrogen storefront. React Router, TypeScript, Shopify commerce and Oxygen hosting.

## Current mode: design demo

The hoodie, reviews and service terms are clearly labeled fictional examples. No payment is collected or real order placed. `MERRIVY_DEMO=true` isolates the worker from linked-store credentials and uses mock.shop. Checkout remains the simulated preview; customer account routes redirect to Help. Search indexing is disabled.

## Local setup

Use Node22 or24. Run `npm ci`, copy `.env.example` to `.env`, replace the session placeholder with a random secret, then `npm run dev`. Local site: http://localhost:3001.

## Checks

Run `npm run typecheck`, `npm run lint`, `npm run test:templates`, `node verification/checkout-destination.mjs`, `node verification/policies.mjs`, `node verification/demo-environment.mjs`, then `npm run build`.

## Product population

Keep the accepted layout. Create a blank packet with `npm run packet:new -- product-slug`; fill and inspect its content, then run `npm run packet:check -- app/content/drafts/product-slug.json`. Change the active packet in app/content/templates.ts. Replace media, product data, genuine proof, offer and service facts together. Sample proof must never become real customer evidence.

## Deployment

Linked Shopify store: Merrivy. Oxygen deploys are currently manual; a GitHub push alone does not update the public site. Use the official Shopify CLI from this project and a local ignored deployment environment file. Never commit `.env*` except the sanitized example, `.shopify`, credentials or deployment logs. PUBLIC demo deployments must retain MERRIVY_DEMO=true until actual product and checkout readiness is independently verified.

Current release evidence is retained in the parent workspace store records. The source repository contains the storefront only, not private research, course materials or the local OS.
