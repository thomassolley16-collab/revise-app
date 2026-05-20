const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured' });

  try {
    const messages = req.body.messages || [];
    let promptText = '';

    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') promptText += part.text + '\n';
        }
      } else if (typeof msg.content === 'string') {
        promptText += msg.content + '\n';
      }
    }

    const geminiBody = JSON.stringify({
      contents: [{ parts: [{ text: promptText.trim() }] }],
      generationConfig: { maxOutputTokens: 1200, temperature: 0.7 }
    });

    const bodyBuffer = Buffer.from(geminiBody, 'utf8');
    const path = `/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': bodyBuffer.length,
        },
      };
      const request = https.request(options, (response) => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      });
      request.on('error', reject);
      request.write(bodyBuffer);
      request.end();
    });

    const data = JSON.parse(result.body);

    if (result.status !== 200) {
      console.error('Gemini error:', JSON.stringify(data));
      return res.status(result.status).json({ error: data.error?.message || 'Gemini API error' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
};
