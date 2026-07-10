/* EDGE Pro — Stripe webhook (Vercel Serverless Function)
 * Lives at  api/stripe-webhook.js  →  https://YOUR-DOMAIN/api/stripe-webhook
 *
 * Set these Environment Variables in Vercel (Project → Settings → Environment Variables):
 *   STRIPE_SECRET_KEY          sk_live_... (or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET      whsec_...   (from the Stripe webhook you create)
 *   SUPABASE_URL               your project URL
 *   SUPABASE_SERVICE_ROLE_KEY  Supabase → Settings → API → service_role key (SERVER ONLY)
 *
 * In Stripe → Developers → Webhooks → Add endpoint:
 *   URL:    https://YOUR-DOMAIN/api/stripe-webhook
 *   Events: checkout.session.completed, customer.subscription.updated,
 *           customer.subscription.deleted
 */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Stripe needs the RAW request body to verify the signature — we read the
// stream directly (Vercel does not pre-parse the body for /api functions).
function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function setPlan(email, plan) {
  if (!email) return;
  await supabase.rpc('set_plan_by_email', { p_email: String(email).toLowerCase(), p_plan: plan });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }

  let evt;
  try {
    const raw = await readRaw(req);
    evt = stripe.webhooks.constructEvent(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.statusCode = 400; res.end(`Webhook signature check failed: ${err.message}`); return;
  }

  try {
    if (evt.type === 'checkout.session.completed') {
      const s = evt.data.object;
      const email = (s.customer_details && s.customer_details.email) || s.customer_email || s.client_reference_id;
      let plan = 'pro';
      try {
        const items = await stripe.checkout.sessions.listLineItems(s.id, { limit: 1 });
        const nick = items.data[0] && items.data[0].price && items.data[0].price.nickname;
        if (nick) plan = nick.toLowerCase();
      } catch (e) {}
      await setPlan(email, plan);
    } else if (evt.type === 'customer.subscription.updated') {
      const sub = evt.data.object;
      const cust = await stripe.customers.retrieve(sub.customer);
      await setPlan(cust.email, (sub.status === 'active' || sub.status === 'trialing') ? 'pro' : 'trial');
    } else if (evt.type === 'customer.subscription.deleted') {
      const sub = evt.data.object;
      const cust = await stripe.customers.retrieve(sub.customer);
      await setPlan(cust.email, 'trial');
    }
  } catch (err) {
    res.statusCode = 500; res.end(`Handler error: ${err.message}`); return;
  }

  res.statusCode = 200; res.end('ok');
};
