// EDGE Pro — AI trade extraction from a broker/prop-firm screenshot.
// Runs on Vercel. Needs env var ANTHROPIC_API_KEY (server-side only — never in client code).

const PROMPT = `You are extracting trades from a screenshot of a trader's broker or prop-firm trade history.
Return ONLY a JSON array (no prose, no markdown fences). Each element is one trade with these fields:
- "date": the trade date as "YYYY-MM-DD" (best guess if partial; today's year if missing)
- "symbol": the instrument/ticker, uppercase (e.g. "EURUSD", "NAS100", "BTCUSD")
- "side": "long" or "short" (map buy->long, sell->short if unclear)
- "pnl": the net profit/loss as a number (negative for losses, no currency symbols or commas)
- "entry": entry price as a number, or null if not shown
- "exit": exit price as a number, or null if not shown
- "rr": realized risk:reward as a number, or null if not shown
Only include rows that are clearly completed trades. If you cannot read any trades, return [].
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
