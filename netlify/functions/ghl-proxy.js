// GHL Analytics Dashboard — Netlify API Proxy
// Sits between the browser and the GHL API to handle CORS and protect your API key.

const GHL_BASE   = 'https://services.leadconnectorhq.com';
const GHL_VER    = '2021-07-28';

// ✔ Only allow these paths through the proxy (security allowlist)
const ALLOWED = [
  '/contacts/',
  '/opportunities/search',
  '/calendars/events',
  '/conversations/search',
  '/forms/submissions',
  '/forms/',
  '/pipelines/',
];

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {

  // Handle pre-flight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { path, params = {}, apiKey } = body;

  // — Validate inputs
  if (!path)   return json(400, { error: 'Missing path' });
  if (!apiKey) return json(400, { error: 'Missing apiKey' });

  // — Enforce allowlist (prevents proxy abuse)
  const allowed = ALLOWED.some(p => path.startsWith(p));
  if (!allowed) return json(403, { error: `Path not permitted: ${path}` });

  // — Build GHL request URL
  const url = new URL(`${GHL_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });

  // — Call GHL API
  try {
    const res  = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'Version':       GHL_VER,
      },
    });

    const data = await res.json();
    return json(res.status, data);

  } catch (err) {
    return json(502, { error: 'Upstream request failed', detail: err.message });
  }
};

// — Helper
function json(status, data) {
  return {
    statusCode: status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}
