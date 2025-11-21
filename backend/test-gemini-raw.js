require('dotenv').config({ path: __dirname + '/.env' });
const axios = require('axios');

async function test() {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${key}`;
  const body = {
    contents: [{
      parts: [{ text: '당신은 음식명 추출 전문가입니다. 사용자가 입력한 텍스트에서 음식명을 추출하세요. 입력: "김치찌개" 요구사항: 1. 정확한 한글 음식명만 추출 2. 여러 음식이 있으면 대표 음식 하나만 선택 JSON 형식으로만 응답: { "foodName": "추출된 음식명" }' }]
    }]
  };
  
  const resp = await axios.post(url, body, { timeout: 30000 });
  const text = resp.data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
  console.log('Raw response from Gemini:');
  console.log(text);
  console.log('\n---');
  
  // Try to parse JSON
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      console.log('Parsed JSON:', parsed);
    } else {
      console.log('No JSON found in response');
    }
  } catch (e) {
    console.log('JSON parse failed:', e.message);
  }
}

test();
