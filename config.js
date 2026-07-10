/* ============================================================
   EDGE Pro — configuration
   Fill these in to go live. Leave blank to keep the local demo.
   Nothing secret goes here — only PUBLIC keys and links.
   (Your Stripe SECRET key must NEVER be in this file.)
   ============================================================ */
window.EDGE_CONFIG = {

  // ---- Stripe (payments) ----
  // Create a Payment Link per plan in the Stripe Dashboard
  // (Product catalog → Payment links) and paste the URLs here.
  // When set, the pricing "Start free trial" buttons open Stripe checkout.
  stripeLinks: {
    starter: "",   // e.g. "https://buy.stripe.com/xxxxxxxx"
    pro:     "",
    funded:  ""
  },

  // ---- Supabase (real accounts) ----
  // Create a project at supabase.com → Project Settings → API.
  // Paste the Project URL and the "anon public" key (NOT the service_role key).
  // When both are set, login/signup use real Supabase Auth (with password
  // reset + Google sign-in). When blank, the app uses local demo accounts.
  supabase: {
    url:     "",   // e.g. "https://abcd1234.supabase.co"
    anonKey: ""    // the anon / public key
  }

};
