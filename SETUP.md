# EDGE Pro — Go-Live Setup

Your app is a set of static files (`index.html`, `login.html`, `app.html`, `config.js`).
It runs as a **local demo** out of the box. To make it public with **real payments**
and **real accounts**, follow the three parts below. All the code is already wired —
you only paste values into **`config.js`**.

> ⚠️ Never put a Stripe **secret** key or a Supabase **service_role** key in `config.js`.
> Only the values below (Payment Link URLs, Supabase URL, anon key) are safe for the browser.

---

## 1. Deploy the site (make it public)

Any static host works. Easiest options:

### Option A — Netlify (drag & drop)
1. Go to https://app.netlify.com/drop
2. Drag this whole `edge-pro` folder onto the page.
3. You get a live URL like `https://your-site.netlify.app`. Done.

### Option B — Vercel
1. Install: `npm i -g vercel`, then run `vercel` in this folder and follow prompts.

### Option C — GitHub Pages
1. Push to GitHub (already done on the `redesign` branch).
2. Repo → **Settings → Pages** → Source: your branch, folder `/root` → Save.
3. Your site is at `https://<user>.github.io/<repo>/`.

Test it: open the URL, click **Start free trial**, create an account, log a trade.

---

## 2. Stripe payments (no server needed)

We use **Payment Links** — Stripe-hosted checkout pages. No backend required.

1. Create a Stripe account → https://dashboard.stripe.com
2. **Products** → add three products (Starter, Pro, Funded) with recurring monthly
   prices ($9 / $15 / $25, or whatever you choose).
3. For each product: **Create payment link** → copy the URL (looks like
   `https://buy.stripe.com/xxxxxxxx`).
4. Open **`config.js`** and paste them:
   ```js
   stripeLinks: {
     starter: "https://buy.stripe.com/aaaa",
     pro:     "https://buy.stripe.com/bbbb",
     funded:  "https://buy.stripe.com/cccc"
   },
   ```
5. Re-deploy. The pricing buttons now open Stripe checkout. When someone pays,
   you'll see it in your Stripe dashboard.

**Free trial:** in the Payment Link settings, enable a **trial period** so the 7-day
trial matches the site copy.

> Want the app to *automatically* unlock paid features after payment? That needs a
> small backend (a Stripe webhook). Ask me and I'll add a serverless function
> (Netlify/Vercel) for it. For launch, Payment Links + manual access is fine.

---

## 3. Real accounts with Supabase (login, signup, password reset, Google)

1. Create a free project at https://supabase.com → **New project** (pick a region,
   set a database password — you won't need it in the app).
2. In the project: **Project Settings → API**. Copy:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **anon public** key (the long one labelled `anon` / `public`)
3. Paste them into **`config.js`**:
   ```js
   supabase: {
     url:     "https://abcd1234.supabase.co",
     anonKey: "eyJhbGci...your-anon-key..."
   }
   ```
4. In Supabase → **Authentication → URL Configuration**, set your **Site URL** to your
   deployed URL (e.g. `https://your-site.netlify.app`) so confirmation/reset emails
   link back correctly.
5. Re-deploy. Now **Sign up / Log in / Forgot password** use real Supabase Auth,
   and accounts work across devices.

### Google sign-in (optional)
- Supabase → **Authentication → Providers → Google** → enable and follow their steps
  (you create Google OAuth credentials and paste them into Supabase). The
  "Continue with Google" button then works automatically.

### Email confirmation
- By default Supabase emails a confirmation link on signup. Users confirm, then log in.
- To skip confirmation while testing: Supabase → **Authentication → Providers → Email**
  → turn **off** "Confirm email".

---

## 4. Cloud data sync (trades follow the user across devices)

The app already syncs each user's data to Supabase in the background — you just need
to create the table.

1. Supabase → **SQL Editor** → open the file **`supabase.sql`** from this repo, paste
   it, and click **Run**. (Creates the `journals` table + a `set_plan_by_email`
   function, with row-level security so users only see their own data.)
2. That's it. Once `config.js` has your Supabase keys (part 3) and a user logs in,
   their trades/playbooks/journal/goals load on any device and save automatically.

> Screenshots are stored inside each user's row (small, downscaled JPEGs). If your
> users attach a lot of them, ask me to move images to Supabase Storage — the hook is
> already in place.

---

## 5. Auto-unlock paid plans after payment (Stripe webhook)

This flips a user to "paid" automatically when they subscribe. It needs one small
serverless function (included at **`netlify/functions/stripe-webhook.js`**).

1. Deploy on **Netlify** (it auto-detects the `netlify/functions` folder).
2. Netlify → **Site settings → Environment variables**, add:
   - `STRIPE_SECRET_KEY` — Stripe → Developers → API keys (`sk_live_...`)
   - `STRIPE_WEBHOOK_SECRET` — from the webhook you create in step 4 (`whsec_...`)
   - `SUPABASE_URL` — your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API → **service_role** key
     (server-only — never put this in `config.js`)
3. Run `supabase.sql` first (part 4) if you haven't — it creates `set_plan_by_email`.
4. Stripe → **Developers → Webhooks → Add endpoint**:
   - URL: `https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Copy the endpoint's **Signing secret** into `STRIPE_WEBHOOK_SECRET`.
5. (Optional) Name each Stripe price's **nickname** `starter` / `pro` / `funded` — the
   webhook uses it as the plan name; otherwise it defaults to `pro`.

Now: user pays → Stripe → webhook → Supabase `journals.plan` updates → the app's
sidebar shows "Pro plan — active" instead of the trial/upgrade button.

> Using Vercel instead of Netlify? Move the file to `api/stripe-webhook.js`, change
> `exports.handler` to `export default function handler(req, res)`, and set the same
> env vars in Vercel. Ask me and I'll convert it for you.

---

## Quick reference — what's safe in `config.js`
| Value | Safe in browser? |
|---|---|
| Stripe **Payment Link** URLs | ✅ yes |
| Supabase **Project URL** | ✅ yes |
| Supabase **anon public** key | ✅ yes (it's meant for the client) |
| Stripe **secret** key (`sk_...`) | ❌ never |
| Supabase **service_role** key | ❌ never |

---

## Vercel notes (you're on Vercel)

- The webhook for Vercel is **`api/stripe-webhook.js`** → its URL is
  `https://YOUR-DOMAIN/api/stripe-webhook`. (The `netlify/` copy is unused on Vercel.)
- Set the 4 env vars from part 5 in **Vercel → Project → Settings → Environment
  Variables**, then **redeploy** so they take effect.
- Root **`package.json`** holds the function's deps (`stripe`, `@supabase/supabase-js`);
  Vercel installs them automatically.
- In **Supabase → Authentication → URL Configuration**, set **Site URL** and add a
  **Redirect URL** for your real domain (e.g. `https://yourdomain.com` and
  `https://yourdomain.com/app.html`) so confirmation / reset / Google links work.

---

## 6. Creator / affiliate program (10% recurring)

The site already has a **Creators page** (`affiliates.html`, linked in the footer),
referral tracking, and promo-code pass-through to Stripe. To turn on real
commission tracking + payouts, use **Tolt** (recommended, made for Stripe SaaS):

1. Create an account at **tolt.io** → connect your Stripe account.
2. Set the commission to **10% recurring** and (optionally) create promo codes
   for your creators.
3. Copy your Tolt **public key** and paste it into `config.js`:
   ```js
   affiliate: { toltKey: "your_tolt_public_key" }
   ```
4. Point the "Become a creator" button at your Tolt signup portal by adding
   `joinUrl` to the same block:
   ```js
   affiliate: { toltKey: "…", joinUrl: "https://youracct.tolt.io" }
   ```
5. Re-deploy. Tolt now tracks referral links + promo codes through Stripe and
   pays your creators 10% recurring automatically. (Rewardful works the same way
   if you prefer it — ask me and I'll swap the snippet.)

Create the **creators@edgeprojournal.com** email so applications reach you.