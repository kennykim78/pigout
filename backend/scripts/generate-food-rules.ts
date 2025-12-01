import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // 더 저렴한 모델

// 100개 음식 목록 (기존 22개 제외)
const NEW_FOODS = [
  // 밥/죽류 (8개)
  '잡곡밥', '김밥', '비빔밥', '볶음밥', '김치볶음밥', '호박죽', '전복죽', '삼계죽',
  
  // 찌개/국/탕류 (15개)
  '김치찌개', '된장찌개', '순두부찌개', '부대찌개', '청국장찌개', '삼계탕', '갈비탕', 
  '설렁탕', '육개장', '감자탕', '곰탕', '추어탕', '미역국', '떡국', '콩나물국',
  
  // 육류 요리 (12개)
  '삼겹살', '불고기', '갈비', '제육볶음', '돼지갈비', '닭갈비', '찜닭', '치킨', 
  '닭볶음탕', '소고기', '한우', '육회',
  
  // 분식/면류 (11개)
  '라면', '냉면', '칼국수', '잔치국수', '비빔국수', '떡볶이', '순대', '튀김', 
  '어묵', '만두', '수제비',
  
  // 반찬/전류 (10개)
  '김치', '깍두기', '시금치나물', '콩나물', '계란찜', '계란말이', '김치전', '파전', 
  '해물파전', '족발',
  
  // 중식 (8개)
  '짜장면', '짬뽕', '탕수육', '마라탕', '마라샹궈', '깐풍기', '유린기', '팔보채',
  
  // 일식 (10개)
  '초밥', '회', '사시미', '돈가스', '우동', '라멘', '소바', '카츠동', '규동', '오니기리',
  
  // 양식 (10개)
  '피자', '햄버거', '파스타', '스파게티', '스테이크', '샐러드', '샌드위치', '리조또', 
  '그라탕', '감자튀김',
  
  // 간식/음료 (8개)
  '빵', '케이크', '쿠키', '아이스크림', '초콜릿', '커피', '콜라', '주스',
  
  // 건강식/다이어트 (8개)
  '닭가슴살샐러드', '연어', '참치', '고등어', '멸치', '달걀프라이', '곤약', '보쌈'
];

const DISEASES = ['당뇨', '고혈압', '고지혈증', '신장질환', '통풍', '간질환', '심장질환', '위장질환', '갑상선질환', '빈혈'];

async function generateFoodRules() {
  const existingDataPath = path.join(__dirname, 'food-rules-data.json');
  const existingData = JSON.parse(fs.readFileSync(existingDataPath, 'utf-8'));
  
  console.log('=== 100개 음식 규칙 데이터 생성 시작 ===');
  console.log(`기존 데이터: ${Object.keys(existingData).length}개`);
  
  const batchSize = 3; // 한 번에 3개씩 처리 (할당량 절약)
  const batches = [];
  
  for (let i = 0; i < NEW_FOODS.length; i += batchSize) {
    batches.push(NEW_FOODS.slice(i, i + batchSize));
  }
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`\n[Batch ${batchIndex + 1}/${batches.length}] 처리 중: ${batch.join(', ')}`);
    
    const prompt = `
당신은 영양학 및 의학 전문가입니다. 아래 음식들에 대해 각각 다음 형식의 JSON 데이터를 생성해주세요.

## 음식 목록
${batch.map((food, idx) => `${idx + 1}. ${food}`).join('\n')}

## 분석 대상 질병
${DISEASES.join(', ')}

## 출력 형식 (각 음식마다)
{
  "음식명": {
    "baseScore": 0-100 사이 정수 (건강도 점수),
    "summary": "1-2문장 요약",
    "pros": "장점 (쉼표로 구분, 30자 이내)",
    "cons": "단점 (쉼표로 구분, 30자 이내)",
    "expertAdvice": "전문가 조언 (1문장)",
    "nutrients": {
      "calories": "kcal/100g",
      "protein": "g",
      "carbs": "g",
      "fat": "g",
      "fiber": "g",
      "sodium": "mg",
      "potassium": "mg",
      "sugar": "g"
    },
    "diseaseAnalysis": {
      "당뇨": { "scoreModifier": -30~+10, "risk": "safe|caution|warning|recommend", "reason": "간단한 이유" },
      "고혈압": { ... },
      ... (10개 질병 모두)
    }
  }
}

**중요 지침:**
- baseScore: 일반적 건강도 (채소/과일 85-95, 육류 70-85, 튀김/가공식품 50-70)
- scoreModifier: 해당 질병에서 점수 조정 (-30~+10)
- risk: safe(안전), caution(주의), warning(경고), recommend(권장)
- nutrients: 실제 영양 데이터 기준 (대표 1인분 기준)
- 반드시 유효한 JSON만 출력하세요. 설명이나 마크다운 없이 순수 JSON만.
`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // JSON 추출 (```json 태그 제거)
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }
      
      const batchData = JSON.parse(jsonText);
      
      // 기존 데이터에 병합
      Object.assign(existingData, batchData);
      
      console.log(`✅ Batch ${batchIndex + 1} 완료 (${Object.keys(batchData).length}개 추가)`);
      
      // 중간 저장 (데이터 손실 방지)
      fs.writeFileSync(existingDataPath, JSON.stringify(existingData, null, 2), 'utf-8');
      
      // Rate limit 방지 (60초 대기 - 무료 플랜)
      if (batchIndex < batches.length - 1) {
        console.log('⏳ 60초 대기 중... (Rate limit 방지)');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
      
    } catch (error) {
      console.error(`❌ Batch ${batchIndex + 1} 실패:`, error.message);
      console.log('현재까지 데이터는 저장되었습니다. 스크립트를 다시 실행하세요.');
      process.exit(1);
    }
  }
  
  console.log('\n=== 생성 완료 ===');
  console.log(`최종 음식 개수: ${Object.keys(existingData).length}개`);
  console.log(`저장 위치: ${existingDataPath}`);
}

generateFoodRules().catch(console.error);
