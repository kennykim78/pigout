const { GoogleGenerativeAI } = require('@google/generative-ai');
const key = 'AIzaSyAkTF4eApD2VEC6ki0FVkx9qWcycOjppNk';
const client = new GoogleGenerativeAI(key);

// JSON만 추출하는 헬퍼 함수
function extractJSON(text) {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('JSON을 찾을 수 없습니다');
  }
  return JSON.parse(jsonMatch[0]);
}

async function testMedicineGeneration() {
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `당신은 의약품 및 건강기능식품 전문가입니다.
사용자가 "타이레놀"을(를) 검색했습니다.

이 제품과 관련된 의약품 또는 건강기능식품 정보를 3개 생성해주세요.
실제로 존재하는 제품명과 유사하게 생성하되, 정확한 정보를 제공해주세요.

다음 JSON 배열 형식으로 응답하세요:
[
  {
    "itemName": "정확한 제품명 (브랜드명 포함)",
    "entpName": "제조사명",
    "itemSeq": "고유번호",
    "efcyQesitm": "효능효과 (100자 이상 상세히)",
    "useMethodQesitm": "용법용량 (복용 방법, 횟수, 주의점 포함)",
    "atpnWarnQesitm": "경고 주의사항",
    "atpnQesitm": "일반 주의사항 (복용 시 주의할 점)",
    "intrcQesitm": "상호작용 (다른 약물/음식과의 상호작용)",
    "seQesitm": "이상반응 (부작용)",
    "depositMethodQesitm": "보관방법",
    "productType": "일반의약품|전문의약품|건강기능식품"
  }
]

JSON 배열만 응답해주세요.`;

  try {
    console.log('=== 의약품 생성 테스트 (타이레놀) ===\n');
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const parsed = extractJSON(text);
    console.log('✅ 생성된 의약품 데이터 (3개):');
    console.log(JSON.stringify(parsed, null, 2));
    
    // 데이터 검증
    console.log('\n📊 데이터 검증:');
    parsed.forEach((item, idx) => {
      console.log(`\n[제품 ${idx + 1}]`);
      console.log(`  ✓ 제품명: ${item.itemName}`);
      console.log(`  ✓ 제조사: ${item.entpName}`);
      console.log(`  ✓ 효능: ${item.efcyQesitm.substring(0, 50)}...`);
      console.log(`  ✓ 용법: ${item.useMethodQesitm.substring(0, 50)}...`);
      console.log(`  ✓ 부작용: ${item.seQesitm.substring(0, 50)}...`);
      console.log(`  ✓ 제품종류: ${item.productType}`);
    });
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

async function testHealthFoodGeneration() {
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `당신은 건강기능식품 전문가입니다.
사용자가 "오메가3"을(를) 검색했습니다.

**중요: 실제로 한국에서 판매되고 있는 건강기능식품 제품을 기반으로 정보를 제공해주세요.**

"오메가3"과 관련된 실제 건강기능식품 정보를 3개 생성해주세요.

다음 JSON 배열 형식으로 응답하세요:
[
  {
    "itemName": "실제 제품명 (브랜드명 + 제품명, 예: 종근당 오메가3)",
    "entpName": "제조사명 (예: 종근당건강, 뉴트리원, 안국건강)",
    "itemSeq": "고유번호",
    "efcyQesitm": "기능성 내용 (혈행 개선, 눈 건강 등 식약처 인정 기능성 포함)",
    "useMethodQesitm": "1일 섭취량, 섭취 방법, 섭취 시기 등",
    "atpnWarnQesitm": "경고 주의사항 (알레르기 등)",
    "atpnQesitm": "섭취 시 주의사항",
    "intrcQesitm": "의약품/음식과의 상호작용 주의사항",
    "seQesitm": "이상반응",
    "depositMethodQesitm": "보관방법",
    "rawMaterial": "주원료 (예: EPA, DHA, 비타민D, 프로바이오틱스 균주명)"
  }
]

규칙:
1. 실제 한국에서 판매되는 건강기능식품 브랜드/제품명 사용 (종근당, 안국건강, 뉴트리원, 대웅제약, 일양약품, 고려은단 등)
2. 식약처 인정 기능성 원료 및 기능성 내용 정확하게 기재
3. 오메가3과 관련된 다양한 제품 (다른 브랜드, 다른 성분 조합) 포함
4. 실제 섭취량 및 방법 기재 (예: 1일 1회 1캡슐)
5. JSON 배열만 응답`;

  try {
    console.log('\n\n=== 건강기능식품 생성 테스트 (오메가3) ===\n');
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const parsed = extractJSON(text);
    console.log('✅ 생성된 건강기능식품 데이터 (3개):');
    console.log(JSON.stringify(parsed, null, 2));
    
    // 데이터 검증
    console.log('\n📊 데이터 검증:');
    parsed.forEach((item, idx) => {
      console.log(`\n[제품 ${idx + 1}]`);
      console.log(`  ✓ 제품명: ${item.itemName}`);
      console.log(`  ✓ 제조사: ${item.entpName}`);
      console.log(`  ✓ 기능성: ${item.efcyQesitm.substring(0, 50)}...`);
      console.log(`  ✓ 섭취방법: ${item.useMethodQesitm}`);
      console.log(`  ✓ 원료: ${item.rawMaterial}`);
      console.log(`  ✓ 보관: ${item.depositMethodQesitm}`);
    });
    
  } catch (e) {
    console.error('❌ Error:', e.message);

async function main() {
  await testMedicineGeneration();
  await testHealthFoodGeneration();
}

main();
