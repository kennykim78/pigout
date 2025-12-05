const { GoogleGenerativeAI } = require('@google/generative-ai');
const key = 'AIzaSyAkTF4eApD2VEC6ki0FVkx9qWcycOjppNk';
const client = new GoogleGenerativeAI(key);

function extractJSON(text) {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('JSON을 찾을 수 없습니다');
  return JSON.parse(jsonMatch[0]);
}

async function testMedicine() {
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `당신은 의약품 전문가입니다. "타이레놀" 검색 결과로 3개의 의약품을 생성하세요.
[{"itemName":"제품명","entpName":"제조사","itemSeq":"번호","efcyQesitm":"효능","useMethodQesitm":"용법","atpnWarnQesitm":"경고","atpnQesitm":"주의","intrcQesitm":"상호작용","seQesitm":"부작용","depositMethodQesitm":"보관","productType":"일반의약품"}]
JSON 배열만 반환하세요.`;
  
  try {
    console.log('=== 의약품 테스트 ===\n');
    const result = await model.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    console.log(JSON.stringify(parsed, null, 2));
    console.log('\n✅ 의약품 데이터 생성 성공\n');
  } catch (e) {
    console.error('❌ 의약품 생성 실패:', e.message);
  }
}

async function testHealthFood() {
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `당신은 건강기능식품 전문가입니다. 실제 한국 제품 기반. "오메가3" 3개 생성.
[{"itemName":"제품명","entpName":"제조사","itemSeq":"번호","efcyQesitm":"기능성","useMethodQesitm":"섭취량","atpnWarnQesitm":"경고","atpnQesitm":"주의","intrcQesitm":"상호작용","seQesitm":"부작용","depositMethodQesitm":"보관","rawMaterial":"원료"}]
JSON만 반환.`;
  
  try {
    console.log('=== 건강기능식품 테스트 ===\n');
    const result = await model.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    console.log(JSON.stringify(parsed, null, 2));
    console.log('\n✅ 건강기능식품 데이터 생성 성공');
  } catch (e) {
    console.error('❌ 건강기능식품 생성 실패:', e.message);
  }
}

async function main() {
  await testMedicine();
  await testHealthFood();
}

main().catch(console.error);
