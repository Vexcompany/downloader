/**
 * Vercel Serverless Proxy — /api/downr
 * Forwards requests to downr.org server-side to bypass CORS.
 */

const DOWNR_UA =
  'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36';

const DOWNR_ANALYTICS = 'https://downr.org/.netlify/functions/analytics';
const DOWNR_DOWNLOAD  = 'https://downr.org/.netlify/functions/download';

export default async function handler(req, res) {
  // Allow requests from the site itself
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid url' });
  }

  try {
    // Step 1: grab session cookie from analytics endpoint
    const analyticsRes = await fetch(DOWNR_ANALYTICS, {
      method: 'GET',
      headers: {
        'referer':    'https://downr.org/',
        'user-agent': DOWNR_UA,
      },
    });

    const rawCookie = analyticsRes.headers.get('set-cookie') || '';

    // Step 2: POST to download endpoint with cookie
    const dlRes = await fetch(DOWNR_DOWNLOAD, {
      method: 'POST',
      headers: {
        'accept':           '*/*',
        'accept-encoding':  'gzip, deflate, br',
        'accept-language':  'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type':     'application/json',
        'cookie':           rawCookie,
        'origin':           'https://downr.org',
        'referer':          'https://downr.org/',
        'sec-ch-ua':        '"Chromium";v="137", "Not/A)Brand";v="24"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-dest':   'empty',
        'sec-fetch-mode':   'cors',
        'sec-fetch-site':   'same-origin',
        'user-agent':       DOWNR_UA,
      },
      body: JSON.stringify({ url }),
    });

    if (!dlRes.ok) {
      const text = await dlRes.text();
      return res.status(dlRes.status).json({ error: `downr.org error: ${dlRes.status}`, detail: text });
    }

    const data = await dlRes.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Proxy error' });
  }
}
