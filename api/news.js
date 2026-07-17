// EDGE Pro — economic-calendar news guard. Proxies a public weekly economic
// calendar feed, normalises it, and returns upcoming high/medium-impact events
// so the app can warn a trader to stand down before big news.
// Runs on Vercel. No API key needed. Cached in memory to be gentle on the source.
const guardAbuse = require('./_guard');

const FEED = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
let CACHE = { at: 0, events: null };
const TTL = 30 * 60 * 1000; // 30 min

function impactRank(s) {
  s = String(s || '').toLowerCase();
  if (s.includes('high')) return 3;
  if (s.includes('med')) return 2;
  if (s.includes('low')) return 1;
  return 0;
}

async function loadEvents() {
  if (CACHE.events && Date.now() - CACHE.at < TTL) return CACHE.events;
  const r = await fetch(FEED, { headers: { 'user-agent': 'EDGEPro/1.0 (+edgeprojournal.com)' } });
  if (!r.ok) throw new Error('feed ' + r.status);
  const raw = await r.json();
  const events = (Array.isArray(raw) ? raw : []).map(e => {
    const when = e.date || e.timestamp || null; // ISO8601 with offset
    const t = when ? Date.parse(when) : NaN;
    return {
      title: String(e.title || e.event || '').slice(0, 120),
      country: String(e.country || e.currency || '').slice(0, 6).toUpperCase(),
      impact: impactRank(e.impact),
      time: isNaN(t) ? null : new Date(t).toISOString(),
      forecast: e.forecast != null ? String(e.forecast).slice(0, 24) : '',
      previous: e.previous != null ? String(e.previous).slice(0, 24) : ''
    };
  }).filter(e => e.time && e.impact >= 2);
  CACHE = { at: Date.now(), events };
  return events;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }
  if (!guardAbuse(req, res)) return;
  try {
    const all = await loadEvents();
    const now = Date.now();
    // keep events from 2h ago through the rest of the week, soonest first
    const events = all
      .filter(e => Date.parse(e.time) > now - 2 * 3600 * 1000)
      .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
      .slice(0, 60);
    res.setHeader('cache-control', 'public, max-age=900');
    res.status(200).json({ events, updated: new Date(CACHE.at).toISOString() });
  } catch (e) {
    res.status(200).json({ events: [], error: 'calendar unavailable' });
  }
};
