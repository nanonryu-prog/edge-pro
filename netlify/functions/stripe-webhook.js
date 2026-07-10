/* EDGE Pro — Stripe webhook (Netlify Function)
 * Marks a user as paid in Supabase when their Stripe subscription changes.
 *
 * Deploy: this file lives at netlify/functions/stripe-webhook.js
 * In Netlify → Site settings → Environment variables, set:
 *   STRIPE_SECRET_KEY          (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET      (whsec_... from the Stripe webhook you create)
 *   SUPABASE_URL               (your project URL)
 *   SUPABASE_SERVICE_ROLE_KEY  (Supabase → Settings → API → service_role key — SERVER ONLY)
 *
 * In Stripe → Developers → Webhooks → Add endpoint:
 *   URL:  https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook
 *   Events: checkout.session.completed, customer.subscription.updated,
 *           customer.subscription.deleted
 */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setPlan(email, plan) {
  if (!email) return;
  await supabase.rpc('set_plan_by_email', { p_email: email.toLowerCase(), p_plan: plan });
}

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let evt;
  try {
    evt = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { statusCode: 400, body: `Webhook signature check failed: ${err.message}` };
  }

  try {
    switch (evt.type) {
      case 'checkout.session.completed': {
        const s = evt.data.object;
        const email = (s.customer_details && s.customer_details.email) || s.customer_email || s.client_reference_id;
        // Optional: derive a plan name from the line item; default to "pro".
        let plan = 'pro';
        try {
          const items = await stripe.checkout.sessions.listLineItems(s.id, { limit: 1 });
          const nick = items.data[0] && items.data[0].price && items.data[0].price.nickname;
          if (nick) plan = nick.toLowerCase();
        } catch (e) {}
        await setPlan(email, plan);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = evt.data.object;
        const cust = await stripe.customers.retrieve(sub.customer);
        await setPlan(cust.email, sub.status === 'active' || sub.status === 'trialing' ? 'pro' : 'trial');
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = evt.data.object;
        const cust = await stripe.customers.retrieve(sub.customer);
        await setPlan(cust.email, 'trial');
        break;
      }
    }
  } catch (err) {
    return { statusCode: 500, body: `Handler error: ${err.message}` };
  }

  return { statusCode: 200, body: 'ok' };
};
