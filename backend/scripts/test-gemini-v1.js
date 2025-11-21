require('dotenv').config({ path: __dirname + '/../.env' });
const axios = require('axios');

async function listModels(key) {
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${key}`;
  const resp = await axios.get(url, { timeout: 20000 });
  return resp.data?.models || [];
}

async function testModel(key, modelName) {
  const url = `https://generativelanguage.googleapis.com/v1/${modelName}:generateContent?key=${key}`;
  const body = { contents: [ { parts: [ { text: '간단히 한글 한 줄로 응답: ping' } ] } ] };
  try {
    const resp = await axios.post(url, body, { timeout: 20000 });
    const text = resp.data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
    console.log('v1 OK on', modelName, '=>', text.slice(0, 120));
    return true;
  } catch (e) {
    const status = e.response?.status;
    const data = e.response?.data || e.message;
    console.error('v1 ERROR on', modelName, ':', status, data?.error?.message || data);
    return false;
  }
}

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('GEMINI_API_KEY not set');
    process.exit(2);
  }
  const models = await listModels(key);
  console.log('Models count:', models.length);
  const gcModels = models.filter(m => (m.supportedGenerationMethods || []).includes('generateContent'));
  console.log('generateContent-capable:', gcModels.map(m => m.name).slice(0, 10));

  // Prefer 1.5 flash/pro if available
  const preferredOrder = [
    'models/gemini-1.5-flash',
    'models/gemini-1.5-pro',
    'models/gemini-1.5-flash-latest',
    'models/gemini-1.5-pro-latest',
  ];

  for (const name of preferredOrder) {
    if (gcModels.find(m => m.name === name)) {
      const ok = await testModel(key, name);
      if (ok) return;
    }
  }

  // Otherwise try the first generateContent-capable model
  if (gcModels[0]) {
    await testModel(key, gcModels[0].name);
  } else {
    console.error('No models with generateContent capability found.');
    process.exit(1);
  }
}

main();
