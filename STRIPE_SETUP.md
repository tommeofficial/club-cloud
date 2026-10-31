# Switching on real payments (Stripe)

The app already has the payment code: `cloud-club/api/checkout.js` starts a Stripe Checkout, and `cloud-club/api/stripe-webhook.js` adds the hours or Pro when a payment completes. Until you add the keys below it stays in **test mode** (purchases are free). Do everything in Stripe's **test mode** first.

## 1. Stripe
1. Create a Stripe account (stripe.com) in your name. Stripe will ask for business and bank details: enter those yourself.
2. In **Product catalogue**, add a product "Club Cloud Pro" with a **recurring monthly price of £9.99**. Copy its **Price ID** (starts `price_`).
3. In **Developers, API keys**, copy the **Secret key** (starts `sk_test_` while testing).
4. In **Developers, Webhooks**, add an endpoint: `https://clubcloud.vip/api/stripe-webhook`, listening for `checkout.session.completed` and `invoice.paid`. Copy its **Signing secret** (starts `whsec_`).

## 2. Supabase
Run `cloud-club/supabase/stripe.sql` in the SQL editor (after `billing.sql`). From Project settings, API, copy the project URL, the anon key and the **service_role** key. Treat the service_role key like a password.

## 3. Vercel (project `cloud-club`, Settings, Environment Variables)
| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | the `sk_test_...` key |
| `STRIPE_WEBHOOK_SECRET` | the `whsec_...` secret |
| `STRIPE_PRICE_PRO` | the Pro price id |
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_ANON_KEY` | the anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |
| `SITE_URL` | `https://clubcloud.vip` |

Redeploy. The shop then sends people to Stripe, and the free test note disappears.

## 4. Test it
Pay with Stripe's test card `4242 4242 4242 4242` (any future date, any CVC). Check the hours or Pro appear. Check the webhook shows delivered in Stripe.

## 5. Before real money
- **Drop the free test functions** in Supabase, or anyone can give themselves Pro:
  `drop function test_buy_hours(integer); drop function test_set_pro(integer);`
- Switch Stripe to live mode and replace the three Stripe values with the live ones, then redeploy.
- Finish and have a solicitor review `cloud-club/terms.html`.
- Tips, song requests, shout-outs, meet and greets and room entry still run as free tests. Paying DJs for those needs Stripe Connect (each DJ onboards with Stripe); that is the next piece to build.
