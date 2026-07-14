// EDGE Pro — AI trade extraction from a broker/prop-firm screenshot or chart.
// Runs on Vercel. Needs env var ANTHROPIC_API_KEY (server-side only — never in client code).

const PROMPT = `You extract a trader's REAL trades from a screenshot. The screenshot is either a trade-HISTORY TABLE or a price CHART (candlesticks). Your #1 job: count trades correctly. ONE trade must never be split into two or more.

Return ONLY a JSON object (no prose, no markdown fences), shaped exactly:
{"source":"history_table"|"chart"|"other","positions":<integer count of DISTINCT real trades you actually see>,"notes":"<one short sentence describing what you saw>","trades":[ <one object per DISTINCT trade> ]}

The length of "trades" MUST equal "positions". Count DISTINCT positions/rows ONLY — never count individual lines, boxes, arrows, zones, or "$" labels as trades.

Each element of "trades":
- "date": "YYYY-MM-DD" (best guess if partial; current year if missing)
- "symbol": instrument/ticker, uppercase (e.g. "SOLUSD", "EURUSD", "NAS100")
- "side": "long" or "short" (buy->long, sell->short)
- "pnl": net profit/loss as a number (negative for losses; no currency symbols/commas). If the trade is still OPEN, use its current/floating P&L.
- "entry": entry/open price as a number, or null
- "exit": close price as a number, or null if the trade is still open
- "stop": stop-loss (S/L) price as a number, or null
- "target": take-profit (T/P) price as a number, or null
- "rr": planned or realized risk:reward as a number, or null
- "status": "closed" or "open"

=== HOW ONE TRADE CAN LOOK LIKE MANY (never split these) ===
A SINGLE position is normally drawn on a chart with SEVERAL of the following at once. ALL of these together are ONE trade:
1. An ENTRY line/marker, a STOP-LOSS line (often red), and a TAKE-PROFIT line (often green). Three lines = ONE trade. Put entry in "entry", S/L in "stop", T/P in "target".
2. Colored risk/reward BOXES: a red/shaded zone (the risk, entry->stop) and a green/shaded zone (the reward, entry->target). The two boxes are the risk and reward of the SAME trade — ONE trade, not two.
3. Each line may carry its own "$" label (e.g. "-2,324.75  +337.09 USD", "+318.49 USD", "+481.22 USD"). These labels are "the P&L IF price reaches this line" for the same position — they are NOT separate trades. A leading big number like "2,324" is the QUANTITY/size, not a second trade.
4. Stop-loss moved to BREAK-EVEN (stop price == entry price): still ONE trade.
5. Stop-loss TRAILED into profit (for a long, the stop line sits ABOVE entry; for a short, BELOW). Now two lines can both look "green/in profit" — this is STILL ONE trade, not two winners. This is the most common cause of double-counting: do not fall for it.
6. Partial take-profits / multiple TP levels (scaling out): still ONE trade.
7. A floating P&L box with a close "X" button and a quantity = ONE open position.

=== IGNORE COMPLETELY (never a trade) ===
- Indicator SIGNAL arrows/triangles/dots (green up-triangles, red down-triangles, buy/sell markers) painted by indicators such as "Wickless Candle Strategy", "FVG Rejection", moving-average crosses, etc. A chart can show DOZENS of these — they are signals, NOT executed trades. Output NONE of them.
- Strategy-tester / backtest trade markers or shaded connector boxes between hypothetical entries and exits.
- OHLC readouts (O/H/L/C values), the bid/ask BUY/SELL buttons, current price, price-axis labels, the countdown timer.
- Indicator value readouts and any stats/summary panel (e.g. a table like "Wickless Bull Candles 1038", "% of Wickless Bull 17.45%", "Total Candles Scanned").
- Pending/working/limit orders that have not filled; deposits, withdrawals, balance/equity rows; commission-only or swap-only rows; header/total/summary rows.
- Drawing-tool measurements, notes, and text you added yourself.

=== TABLES ===
If it is a trade-HISTORY TABLE, each data ROW (with date/time, symbol, side, open & close price, profit/loss) is ONE trade. S/L and T/P shown in a row are part of THAT row's trade, not extra trades. If one position spans several rows (open, modify, close), combine to ONE. Skip the row types listed under IGNORE.

=== CHART WITH A LIVE POSITION ===
A chart usually shows at MOST ONE real position (sometimes zero, occasionally a couple if genuinely pyramiding the same symbol). If you see a real position (currency P&L, quantity, close "X"), output exactly ONE trade for it. If the position is still running, set "status":"open" and use the floating P&L. If nothing but candles, indicators and signal arrows are present with no real position, return "trades":[].

If you truly cannot read any real trade, return {"source":"other","positions":0,"notes":"...","trades":[]}.
Example: {"source":"chart","positions":1,"notes":"one open SOL short with SL trailed to profit and a TP line","trades":[{"date":"2026-07-14","symbol":"SOLUSD","side":"short","pnl":337.09,"entry":75.09,"exit":null,"stop":74.99,"target":74.88,"rr":2.0,"status":"open"}]}`;

function extractTrades(text) {
  if (!text) return [];
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
  // 1) whole thing is JSON
  const tryParse = (s) => { try { return JSON.parse(s); } catch (e) { return undefined; } };
  let parsed = tryParse(t);
  // 2) first {...} object
  if (parsed === undefined) { const m = t.match(/\{[\s\S]*\}/); if (m) parsed = tryParse(m[0]); }
  // 3) first [...] array
  if (parsed === undefined) { const m = t.match(/\[[\s\S]*\]/); if (m) parsed = tryParse(m[0]); }
  if (parsed === undefined) return [];
  let trades = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.trades) ? parsed.trades : []);
  if (!Array.isArray(trades)) trades = [];
  return trades;
}

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
        model: 'claude-sonnet-5',
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
    let trades = extractTrades(text);
    // sanity: drop anything without a usable P&L number
    trades = trades.filter(t => t && typeof t.pnl === 'number' && !isNaN(t.pnl)).slice(0, 100);
    res.status(200).json({ trades });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
};
