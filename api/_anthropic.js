// Calls the Anthropic Messages API with one automatic retry on transient
// failures (5xx / 429 / network errors), so a momentary hiccup never reaches
// the user. Returns the fetch Response.
module.exports = async function callAnthropic(key, body) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body)
      });
      if (r.ok) return r;
      // retry once on transient upstream errors
      if (attempt === 0 && (r.status >= 500 || r.status === 429)) { await new Promise(res => setTimeout(res, 700)); continue; }
      return r;
    } catch (e) {
      lastErr = e;
      if (attempt === 0) { await new Promise(res => setTimeout(res, 700)); continue; }
      throw e;
    }
  }
  throw lastErr || new Error('AI request failed');
};
