const FALLBACK = 'A practical next step is to keep every payment on time, keep revolving credit below 30% where possible, and compare the total repayment cost — not only the monthly EMI. Not financial advice.';

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(payload)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON body' }); }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const mode = body.mode === 'eligibility' ? 'eligibility' : 'chat';
  if (!prompt || prompt.length > 1800) return json(400, { error: 'A short prompt is required.' });
  if (!process.env.ANTHROPIC_API_KEY) return json(200, { text: FALLBACK, fallback: true });

  const system = [
    'You are a careful Indian personal-finance assistant inside LoanCheck.',
    'Give concise, practical guidance for Indian borrowers. Use INR and Indian loan context when relevant.',
    'Never claim to approve a loan, guarantee an outcome, or replace a qualified financial professional.',
    'Do not ask for or infer Aadhaar, PAN, bank account, card number, password, or other sensitive identifiers.',
    'Use only the financial context provided by the user. If something is missing, say what assumption you are making.',
    'End every answer with the exact short note: Not financial advice.'
  ].join(' ');
  const context = body.context && typeof body.context === 'object' ? JSON.stringify(body.context).slice(0, 5000) : '{}';
  const userMessage = `Mode: ${mode}\nUser request: ${prompt}\nAvailable app context: ${context}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022', max_tokens: 260, temperature: 0.2, system, messages: [{ role: 'user', content: userMessage }] }),
      signal: controller.signal
    });
    if (!response.ok) return json(200, { text: FALLBACK, fallback: true });
    const data = await response.json();
    const text = Array.isArray(data.content) ? data.content.filter((item) => item.type === 'text').map((item) => item.text).join('\n').trim() : '';
    if (!text) return json(200, { text: FALLBACK, fallback: true });
    return json(200, { text: text.slice(0, 2400), fallback: false });
  } catch {
    return json(200, { text: FALLBACK, fallback: true });
  } finally { clearTimeout(timeout); }
};
