// Basic abuse protection for the AI endpoints.
// 1) Same-site origin check — blocks other sites (and naive curl with no referer)
//    from calling your paid AI endpoints.
// 2) Per-IP rate limit (best-effort, in warm-instance memory) — caps how fast one
//    caller can burn the Anthropic budget.
// NOTE: this is defence-in-depth. The hard safety net is an Anthropic spend cap
// (console.anthropic.com → Billing → limits). Set one before launch.
module.exports = function guardAbuse(req, res) {
  const ref = ((req.headers && (req.headers.referer || '')) + ' ' + (req.headers && (req.headers.origin || '')));
  const ok = /edgeprojournal\.com/i.test(ref) || /localhost|127\.0\.0\.1/.test(ref);
  if (!ok) { res.status(403).json({ error: 'Forbidden' }); return false; }
  const ip = ((req.headers && (req.headers['x-forwarded-for'] || '')) + '').split(',')[0].trim() || 'x';
  globalThis.__edgeRL = globalThis.__edgeRL || new Map();
  const now = Date.now();
  const arr = (globalThis.__edgeRL.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now);
  globalThis.__edgeRL.set(ip, arr);
  if (globalThis.__edgeRL.size > 5000) globalThis.__edgeRL.clear(); // avoid unbounded memory
  if (arr.length > 20) { res.status(429).json({ error: 'Too many requests — please slow down a moment.' }); return false; }
  return true;
};
