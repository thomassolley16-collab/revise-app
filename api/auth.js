const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

function supabaseAuth(endpoint, body) {
  return new Promise((resolve, reject) => {
    const bodyBuffer = Buffer.from(JSON.stringify(body), 'utf8');
    const url = new URL(SUPABASE_URL);

    const options = {
      hostname: url.hostname,
      path: `/auth/v1/${endpoint}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY.trim(),
        'Authorization': `Bearer ${SUPABASE_ANON_KEY.trim()}`,
        'Content-Length': bodyBuffer.length,
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });

    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    let endpoint;
    if (action === 'signup') {
      endpoint = 'signup';
    } else {
      endpoint = 'token?grant_type=password';
    }

    const result = await supabaseAuth(endpoint, { email, password });
    const data = JSON.parse(result.body);

    if (result.status >= 400) {
      return res.status(result.status).json({ 
        error: data.error_description || data.msg || data.error || 'Authentication failed' 
      });
    }

    // Return the session data
    res.status(200).json(data);
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: err.message });
  }
};
