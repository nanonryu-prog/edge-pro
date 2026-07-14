# EDGE Pro — Go-Live Checklist

Everything that has to be true before (and right after) you take real users and real money.
Work top to bottom. The 🔴 items are blockers — don't launch until they're done.

---

## 🔴 1. Security — rotate any exposed keys (do this TODAY)

During building, some keys appeared in screenshots. Any secret that has ever been shown must be replaced.

- [ ] **Anthropic API key** — console.anthropic.com → API keys → delete the old one → create a new one → in Vercel (Project → Settings → Environment Variables) update `ANTHROPIC_API_KEY` → Redeploy.
- [ ] **Supabase `service_role` / secret key** — Supabase → Project Settings → API → roll the `service_role` key if it was ever exposed. Update it anywhere it's used server-side (Vercel env vars). **Never** put `service_role` in `config.js` or any client file.
- [ ] **Supabase `anon` key** — this one is *public by design* (it's protected by Row Level Security). It's fine that it lives in `config.js`. No action needed — just make sure RLS is ON (see step 3).

> Rule of thumb: anything called *secret / service_role / secret key* is server-only. Anything called *anon / publishable* is safe in the browser.

---

## 🔴 2. Payments — turn on Stripe

The app is fully wired; it just needs your links. Nothing charges until these are filled in.

- [ ] In Stripe → **Product catalog**, create 3 recurring prices: Starter ($9/mo), Pro ($15/mo), Funded ($25/mo).
- [ ] For each, create a **Payment Link** (Stripe → Payment links).
- [ ] Paste the 3 URLs into `config.js` → `stripeLinks`:
  ```js
  stripeLinks: {
    starter: "https://buy.stripe.com/...",
    pro:     "https://buy.stripe.com/...",
    funded:  "https://buy.stripe.com/..."
  }
  ```
- [ ] Commit + push. The moment these are set, the pricing buttons on the landing page point to Stripe **and** the in-app 7-day trial paywall activates automatically.
- [ ] (Optional) turn on Stripe's free-trial on each price if you want the trial enforced by Stripe too.

---

## 🔴 3. Supabase — accounts & data safety

- [ ] **Authentication → URL Configuration**: Site URL = `https://edgeprojournal.com`; add Redirect URLs `https://edgeprojournal.com/**`.
- [ ] **Row Level Security is ON** for the `journals` table, with a policy so each user can only read/write rows where `user_id = auth.uid()`. This is what keeps one user from reading another's trades. Verify it.
- [ ] Confirm email/password sign-up + login works on the live site.

---

## 4. Google sign-in — publish it

- [ ] Google Cloud Console → OAuth consent screen → **Publish app** (move from Testing to Production) so anyone can use "Continue with Google", not just test users.
- [ ] Make sure the Supabase callback URL is in the Authorized redirect URIs.

---

## 5. Support inboxes — make the emails real

The site uses these addresses — set them up (or forward them all to one inbox you check):
- `support@edgeprojournal.com` (main)
- `privacy@edgeprojournal.com`
- `hello@edgeprojournal.com`, `creators@edgeprojournal.com`, `careers@edgeprojournal.com`

- [ ] In your domain/email host, create these as forwarding aliases → your real inbox. A dead support email kills trust fast.

---

## 6. AI features

- [ ] `ANTHROPIC_API_KEY` set in Vercel (server-side only) — powers AI screenshot import + AI Coach.
- [ ] Set a spend limit / billing alert in the Anthropic console so a spike can't surprise you.
- [ ] Smoke test on live: paste a broker screenshot → trades come back; log 5 trades → AI Coach generates a report.

---

## 7. Legal & trust (done — just review)

- [x] Privacy Policy (`privacy.html`) — includes AI data handling.
- [x] Terms (`terms.html`) — includes "not financial advice" + AI clause.
- [x] Legal links on login + in Settings; "your data is yours" promise in Settings.
- [ ] Have a lawyer skim the two legal pages for your jurisdiction, and set your real business/entity name where noted.

---

## 8. Final smoke test (as a brand-new user)

- [ ] Sign up fresh → onboarding runs → log/import a first trade → dashboard + coach light up.
- [ ] Log on desktop, confirm it syncs to another device.
- [ ] Export data (JSON + CSV), then delete account — confirm both work.
- [ ] Check the landing page, pricing, and a legal page on a phone.

---

## After launch (first week)
- Get 5–10 real traders using it and **ask what's confusing**. Fix that, not new features.
- Collect 2–3 testimonials → add them to the landing page.
- Post the short-form videos (`VIDEOS.md`) + launch posts (`LAUNCH.md`).
