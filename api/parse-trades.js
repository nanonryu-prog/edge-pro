// EDGE Pro — AI trade extraction from a broker/prop-firm screenshot.
// Runs on Vercel. Needs env var ANTHROPIC_API_KEY (server-side only — never in client code).

const PROMPT = `You are extracting COMPLETED, CLOSED trades from a screenshot of a trader's broker or prop-firm trade history.
Return ONLY a JSON array (no prose, no markdown fences). Each element is ONE closed trade with these fields:
- "date": the trade date as "YYYY-MM-DD" (best guess if partial; current year if missing)
- "symbol": the instrument/ticker, uppercase (e.g. "EURUSD", "NAS100", "BTCUSD")
- "side": "long" or "short" (map buy->long, sell->short)
- "pnl": the net profit/loss as a number (negative for losses; no currency symbols or commas)
- "entry": entry/open price as a number, or null if not shown
- "exit": exit/close price as a number (the price it actually closed at), or null if not shown
- "stop": the stop-loss (S/L) price of THIS trade as a number, or null if not shown
- "target": the take-profit (T/P) price of THIS trade as a number, or null if not shown
- "rr": planned or realized risk:reward as a number, or null if not shown

CRITICAL RULES — do not create false trades:
1. A stop-loss (S/L, SL) and a take-profit (T/P, TP) are PART of a trade. They are NEVER separate trades. If one row/position shows an entry price plus an S/L and/or T/P, that is exactly ONE trade — put the entry in "entry", the actual close price in "exit", the S/L in "stop", and the T/P in "target". Do NOT turn the S/L or T/P price into its own trade. Note: a stop-loss moved to break-even (equal to the entry price) is normal — still just part of the one trade.
2. IGNORE entirely: pending/working orders, orders that are still open/running, S/L or T/P order lines, deposits, withdrawals, balance/equity rows, commission-only or swap-only rows, and any header, total or summary rows.
3. If the same position appears as several rows (open, modify, close), combine them into ONE trade.
4. Only include a trade if it is clearly closed and has a real profit/loss.
If you cannot confidently read any closed trades, return [].
Example: [{"date":"2025-06-14","symbol":"EURUSD","side":"long","pnl":180,"entry":1.0821,"exit":1.0865,"rr":2.1}]`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error: 'AI import is not configured yet. Add ANTHROPIC_API_KEY in Vercel.' }); return; }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const image = body && body.image;
    const media_type = (body && body.media_type) || 'image/png';
    if (!image) { res.status(400).json({ error: 'No image provided' }); return; }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type, data: image } },
          { type: 'text', text: PROMPT }
        ] }]
      })
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: (data.error && data.error.message) || 'AI request failed' }); return; }
    const text = (data.content || []).map(c => c.text || '').join('');
    const m = text.match(/\[[\s\S]*\]/);
    let trades = [];
    if (m) { try { trades = JSON.parse(m[0]); } catch (e) { trades = []; } }
    if (!Array.isArray(trades)) trades = [];
    res.status(200).json({ trades: trades.slice(0, 100) });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
};
