/**
 * Vercel Serverless Proxy — /api/downr
 * Forwards requests to downr.org server-side to bypass CORS.
 */

const DOWNR_UA =
  'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

const DOWNR_ANALYTICS = 'https://downr.org/.netlify/functions/analytics';
const DOWNR_DOWNLOAD  = 'https://downr.org/.netlify/functions/download';

/**
 * Node's fetch returns set-cookie as a single combined string.
 * We need to extract only the key=value pairs (strip attributes like
 * Path, SameSite, HttpOnly, Secure, Expires) and join them for the
 * Cookie request header.
 */
function parseCookies(raw) {
  if (!raw) return '';
  // set-cookie can be a string or array depending on Node version
  const parts = Array.isArray(raw) ? raw : raw.split(/,(?=[^ ])/);
  return parts
    .map(part => part.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid url' });
  }

  try {
    // Step 1: hit analytics to get session cookie
    const analyticsRes = await fetch(DOWNR_ANALYTICS, {
      method: 'GET',
      headers: {
        'referer':    'https://downr.org/',
        'user-agent': DOWNR_UA,
      },
      redirect: 'follow',
    });

    // getSetCookie() is available in Node 18+ (Vercel default runtime)
    // Falls back to get('set-cookie') for older runtimes
    const rawCookies = analyticsRes.headers.getSetCookie
      ? analyticsRes.headers.getSetCookie()
      : [analyticsRes.headers.get('set-cookie') || ''];

    const cookie = rawCookies
      .map(c => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    // Step 2: POST the URL to the download endpoint
    const dlRes = await fetch(DOWNR_DOWNLOAD, {
      method: 'POST',
      headers: {
        'accept':             '*/*',
        'accept-language':    'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type':       'application/json',
        'cookie':             cookie,
        'origin':             'https://downr.org',
        'referer':            'https://downr.org/',
        'sec-ch-ua':          '"Chromium";v="137", "Not/A)Brand";v="24"',
        'sec-ch-ua-mobile':   '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-dest':     'empty',
        'sec-fetch-mode':     'cors',
        'sec-fetch-site':     'same-origin',
        'user-agent':         DOWNR_UA,
      },
      body: JSON.stringify({ url }),
    });

    const responseText = await dlRes.text();

    if (!dlRes.ok) {
      console.error(`[proxy] downr.org ${dlRes.status}:`, responseText.slice(0, 300));
      return res.status(dlRes.status).json({
        error: `downr.org responded with ${dlRes.status}`,
        detail: responseText.slice(0, 300),
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('[proxy] Non-JSON from downr.org:', responseText.slice(0, 300));
      return res.status(502).json({ error: 'Unexpected response format', detail: responseText.slice(0, 300) });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[proxy] fetch error:', err);
    return res.status(500).json({ error: err.message || 'Proxy error' });
  }
}
