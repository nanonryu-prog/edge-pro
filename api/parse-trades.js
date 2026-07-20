// EDGE Pro — AI trade extraction from a broker/prop-firm screenshot or chart.
const guardAbuse = require('./_guard');
const callAnthropic = require('./_anthropic');
// Runs on Vercel. Needs env var ANTHROPIC_API_KEY (server-side only — never in client code).

const PROMPT = `You extract a trader's REAL trades from a screenshot. The screenshot is either a trade-HISTORY TABLE or a price CHART (candlesticks). Your #1 job: count trades correctly. ONE trade must never be split into two or more.

=== NEVER FABRICATE — accuracy beats completeness (most important rule) ===
A wrong number silently corrupts the trader's entire journal, so:
- If you cannot clearly and confidently read a value, set that field to null. A missing field is fine; a guessed number is NOT. Never estimate, never round from a blur, never invent a digit to "fill in" a field.
- Only output a trade if you can actually READ a real P&L for it. If a trade's P&L is unreadable, cut off at the edge, or you'd be guessing — do not output that trade at all.
- If the image is blurry, low-res, cropped, glare-covered, or you're not even sure it shows real executed trades, return "trades":[] with a note explaining why. Returning nothing is ALWAYS better than returning wrong data.
- You WILL see platforms, languages, currencies and layouts you don't recognize — that is expected and completely fine. Apply the same universal logic to ANY layout; never fabricate or give up just because the platform is unfamiliar. If it's genuinely not a trading screenshot at all (a meme, a photo, random UI), return "trades":[] and say so.
- Do not assume a "typical" value. If entry/stop/target/rr aren't shown, they are null — never back-fill them from the P&L or a guess.

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

=== PLATFORMS YOU MUST HANDLE ===
Screenshots come from anywhere — read them all: MetaTrader 4/5 (History tab), cTrader, TradingView (paper-trading History or the account/positions panel), prop-firm dashboards (FTMO, MyFundedFX, FundingPips, Apex, TopStep, etc.), broker web/apps (OANDA, IC Markets, Pepperstone), crypto exchanges (Binance, Bybit, Bitget, OKX — spot or futures), stock/options brokers (Robinhood, Webull, Thinkorswim, IBKR), and small cramped MOBILE-app screenshots. Layouts differ; the rule never changes: one CLOSED position = one trade.

=== READING NUMBERS CORRECTLY (never get the sign or value wrong) ===
- A loss can be written "-90", "(90.00)" (accounting parentheses = NEGATIVE), or as a red number — all mean a LOSS, so output a negative "pnl".
- Use the NET / realized profit for each trade — the final profit that already includes commission and swap. If there are separate Commission / Swap / Fee columns or rows, do NOT turn them into their own trades and do not double-count them.
- A running BALANCE or EQUITY column is NOT the trade's P&L. Never put an account balance in "pnl" — use the profit/P&L column only.
- Numbers may use commas as thousands separators ("1,234.50"); read the real value and output a plain number.
- WATCH DECIMAL vs THOUSANDS SEPARATORS — this is the #1 way to get a value 1000x wrong. US/UK writes "1,234.56"; many EU/LatAm/Asian platforms write the SAME value as "1.234,56" or "1 234,56". Rule of thumb: the LAST separator followed by exactly 1-2 digits is the DECIMAL point; separators every 3 digits are thousands. Read "1.234,56" as 1234.56, and "89,50" (EU) as 89.5, not 8950. When in doubt about the magnitude, prefer the reading that's a sensible trade P&L.
- Currency symbols appear before OR after the number and vary widely ($, €, £, ¥, ₩, R$, ₹, C$, A$, USD, EUR…). Strip the symbol, keep the number.
- If P&L is shown only in PIPS, POINTS, TICKS, or a PERCENTAGE (not account currency) and you cannot reliably convert it to money, set pnl to null and note it — do NOT output a made-up dollar figure.
- Don't confuse SIZE/QUANTITY (lots, contracts, shares, units — often a small round number like 0.10, 2, 100) or LEVERAGE ("10x", "1:100") or MARGIN with the P&L. The P&L is the realized/floating profit column, usually with a +/- sign or red/green colour.
- Side mapping: buy / long / "B" = long; sell / short / "S" = short. On a chart, entry below the take-profit is usually a long; entry above it is usually a short.
- Dates: keep what the platform shows; if the format is ambiguous (DD/MM vs MM/DD) keep the digits as shown and use the current year only when the year is missing. Never invent a date.
- Combine PARTIAL fills / partial closes of the SAME position (same symbol, adjacent time) into ONE trade with the total net P&L.
- If it's clearly a P&L SUMMARY / stats card (totals, win rate, averages) and not a per-trade list, that is NOT trades — return "trades":[].

All numeric fields must be plain JSON numbers — no quotes, no currency symbols, no thousands separators (write 1234.5, not "1,234.50 USD"). If a mark could be a drawn plan/projection rather than a really-executed fill, leave it out. Before you answer, RECOUNT: the number of items in "trades" MUST equal "positions" — if they differ you double-counted; fix it.
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
  if (!guardAbuse(req, res)) return;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error: 'AI import is not configured yet. Add ANTHROPIC_API_KEY in Vercel.' }); return; }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const image = body && body.image;
    const media_type = (body && body.media_type) || 'image/png';
    if (!image) { res.status(400).json({ error: 'No image provided' }); return; }

    const r = await callAnthropic(key, {
      model: 'claude-sonnet-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type, data: image } },
        { type: 'text', text: PROMPT }
      ] }]
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: (data.error && data.error.message) || 'AI request failed' }); return; }
    const text = (data.content || []).map(c => c.text || '').join('');
    let trades = extractTrades(text);
    // normalize + coerce string numbers (models sometimes return "1,234.50 USD")
    const num = v => { if (v == null || v === '') return null; let s = String(v).trim(); const neg = /^\(.*\)$/.test(s); let n = parseFloat(s.replace(/[^0-9.\-]/g, '')); if (isNaN(n)) return null; if (neg) n = -Math.abs(n); return n; };
    const norm = t => {
      if (!t || typeof t !== 'object') return null;
      const pnl = num(t.pnl);
      if (pnl === null) return null; // no usable P&L → not a trade
      let side = String(t.side || '').toLowerCase();
      side = (side.includes('short') || side.includes('sell')) ? 'short' : 'long';
      return {
        date: t.date ? String(t.date).slice(0, 10) : null,
        symbol: t.symbol ? String(t.symbol).toUpperCase().trim() : '—',
        side, pnl,
        entry: num(t.entry), exit: num(t.exit), stop: num(t.stop), target: num(t.target), rr: num(t.rr),
        status: String(t.status || '').toLowerCase() === 'open' ? 'open' : 'closed'
      };
    };
    trades = trades.map(norm).filter(Boolean);
    // guard against one position being read twice: drop exact duplicates
    const seen = new Set();
    trades = trades.filter(t => { const k = [t.date, t.symbol, t.side, t.pnl, t.entry, t.exit].join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
    trades = trades.slice(0, 100);
    res.status(200).json({ trades });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
};
