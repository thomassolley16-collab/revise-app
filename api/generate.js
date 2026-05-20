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
    // Convert Anthropic-style messages to Gemini format
    const messages = req.body.messages || [];
    const geminiContents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: Array.isArray(msg.content)
        ? msg.content.map(c => {
            if (c.type === 'text') return { text: c.text };
            if (c.type === 'image') return {
              inlineData: { mimeType: c.source.media_type, data: c.source.data }
            };
            return { text: '' };
          })
        : [{ text: msg.content }]
    }));

    const geminiBody = JSON.stringify({
      contents: geminiContents,
      generationConfig: {
        maxOutputTokens: req.body.max_tokens || 1200,
        temperature: 0.7,
      }
    });

    const bodyBuffer = Buffer.from(geminiBody, 'utf8');
    const path = `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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
        response.on('end', () => {
          resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') });
        });
      });

      request.on('error', reject);
      request.write(bodyBuffer);
      request.end();
    });

    const data = JSON.parse(result.body);

    if (result.status !== 200) {
      console.error('Gemini error:', data);
      return res.status(result.status).json({ error: data.error?.message || 'Gemini API error' });
    }

    // Convert Gemini response back to Anthropic format so frontend works unchanged
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
};
