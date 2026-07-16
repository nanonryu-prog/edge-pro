// EDGE Pro — AI Trade Coach. Turns a trader's own aggregated journal into a
const guardAbuse = require('./_guard');
// personal "Edge Report". Runs on Vercel. Needs env var ANTHROPIC_API_KEY.

const SYSTEM = `You are EDGE Pro's AI trading coach — sharp, honest, and encouraging like a great mentor, never generic. You are given ONE trader's aggregated journal statistics (already computed and accurate — trust them, do not recalculate). Your job is to read the numbers like a coach and hand back a short, punchy, personal report.

Rules:
- Speak directly to the trader as "you". Be concrete and reference their real numbers (win rate, P&L, discipline, tags, emotions, after-a-loss behaviour, notes).
- Be honest about leaks but constructive — the goal is one clear improvement, not a lecture.
- Prioritise the biggest lever. The most valuable insight is usually the gap between "clean" (rules followed) and "rule-broken" trades, or an emotion / after-a-loss pattern that's costing money.
- A high win rate with small wins is a valid edge — protect it by keeping losses small. Only warn if avg loss is near/above avg win.
- If a tag/setup clearly performs best, name it as their money-maker.
- Keep every string tight. No markdown, no emoji, no preamble.
- ACCURACY IS CRITICAL: only cite numbers that literally appear in the provided data. NEVER invent, guess, or estimate a statistic that isn't given, and never restate a number inaccurately. If a figure isn't in the data, speak qualitatively instead of stating a number.
- Respect sample size: a tag, emotion or mistake based on very few trades (roughly under 5) is an early signal, not a proven pattern — say so rather than overclaiming.
- Give a fair letter grade for overall trading discipline & edge (A+ down to F): reward good discipline, positive expectancy and consistency; penalise rule-breaking and losses bigger than wins.

Return ONLY a JSON object (no markdown fences), shaped exactly:
{
 "grade": "B+",
 "headline": "one punchy sentence summarising where they stand",
 "statLine": "one short data comparison, e.g. 'Clean setups win 71% vs 38% when you break a rule'",
 "strengths": ["1-3 short specific strengths"],
 "leaks": ["1-3 short specific things costing money, with $ amounts where the data has them"],
 "bestSetup": "their best-performing setup/tag with its stats, or empty string if none stands out",
 "focus": "the single most important thing to do next week, specific and actionable"
}`;

function extractReport(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const tryParse = (s) => { try { return JSON.parse(s); } catch (e) { return undefined; } };
  let parsed = tryParse(t);
  if (parsed === undefined) { const m = t.match(/\{[\s\S]*\}/); if (m) parsed = tryParse(m[0]); }
  if (parsed === undefined || typeof parsed !== 'object') return null;
  const arr = (x) => Array.isArray(x) ? x.map(String).filter(Boolean).slice(0, 4) : [];
  return {
    grade: String(parsed.grade || '—').slice(0, 4),
    headline: String(parsed.headline || '').slice(0, 300),
    statLine: String(parsed.statLine || '').slice(0, 240),
    strengths: arr(parsed.strengths),
    leaks: arr(parsed.leaks),
    bestSetup: String(parsed.bestSetup || '').slice(0, 200),
    focus: String(parsed.focus || '').slice(0, 300)
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!guardAbuse(req, res)) return;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error: 'AI coach is not configured yet. Add ANTHROPIC_API_KEY in Vercel.' }); return; }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const brief = body && body.brief;
    if (!brief || typeof brief !== 'object') { res.status(400).json({ error: 'No journal data provided' }); return; }
    if (!brief.range || !brief.range.trades) { res.status(400).json({ error: 'Not enough trades to coach yet' }); return; }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1400,
        system: SYSTEM,
        messages: [{ role: 'user', content: "Here is my aggregated trading journal. Give me my Edge Report.\n\n" + JSON.stringify(brief) }]
      })
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: (data.error && data.error.message) || 'AI request failed' }); return; }
    const text = (data.content || []).map(c => c.text || '').join('');
    const report = extractReport(text);
    if (!report) { res.status(502).json({ error: 'Coach could not read a report — try again' }); return; }
    res.status(200).json({ report });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
};
