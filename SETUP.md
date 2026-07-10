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

## What still lives only in the browser

With Supabase Auth enabled, **login is real and cross-device**, but a user's **trades,
playbooks, and journal are still stored locally** in that browser (via `localStorage`),
and trade **screenshots** likewise.

To sync all of that to the cloud (so a user sees their data on any device), the next
step is moving the app's `Store` to Supabase database tables + Supabase Storage for
images. That's a focused follow-up — tell me when you want it and I'll wire it.

---

## Quick reference — what's safe in `config.js`
| Value | Safe in browser? |
|---|---|
| Stripe **Payment Link** URLs | ✅ yes |
| Supabase **Project URL** | ✅ yes |
| Supabase **anon public** key | ✅ yes (it's meant for the client) |
| Stripe **secret** key (`sk_...`) | ❌ never |
| Supabase **service_role** key | ❌ never |
