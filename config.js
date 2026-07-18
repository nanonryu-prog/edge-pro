/* ============================================================
   EDGE Pro — configuration
   Only PUBLIC, browser-safe values live here.
   NEVER put a Stripe SECRET key or the Supabase SERVICE_ROLE /
   SECRET key in this file — those go only in Vercel env vars.
   ============================================================ */
window.EDGE_CONFIG = {

  // ---- Stripe (payments) ----
  // Paste your Stripe Payment Link URLs (Dashboard → Payment links).
  stripeLinks: {
    starter: "",   // e.g. "https://buy.stripe.com/xxxxxxxx"
    pro:     "",
    funded:  ""
  },

  // ---- Stripe ANNUAL payment links (2 months free: $90 / $190 / $390 per year) ----
  // Create these as yearly prices in Stripe, then paste the Payment Link URLs.
  // Leave blank and the Annual toggle still shows prices; buttons fall back to signup.
  stripeLinksAnnual: {
    starter: "",
    pro:     "",
    funded:  ""
  },

  // ---- Supabase (real accounts + cloud sync) ----
  supabase: {
    url:     "https://tcttcjxsbmbknqrqhhek.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdHRjanhzYm1ia25xcnFoaGVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjU0NDMsImV4cCI6MjA5ODY0MTQ0M30.KYLeWNZ5CPKLPKEPue0Rv-xK3hVgnFOWKT9W78HgeRI"
  },

  // ---- Affiliate / creator program (optional) ----
  // Recommended engine: Tolt (tolt.io) — connects to your Stripe, gives creators
  // promo codes + referral links, auto-tracks 10% recurring commissions, handles
  // payouts. Create a Tolt account, connect Stripe, paste your public key here.
  affiliate: {
    toltKey: ""   // your Tolt public key (data-tolt) — leave blank to disable
  }

};
