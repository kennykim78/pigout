const axios = require('axios');

const SERVICE_KEY = 'cabe7a5f0fe9d0d13d6f2f61fa27635d52d2a38f85a8d6ab7d56a08c0666963c';
const RECIPE_KEY = 'e2bed7f054fe4a38863f';

/**
 * 통합 테스트: 레시피 API + e약은요 API
 */
async function testIntegratedAnalysis() {
  console.log('\n===========================================');
  console.log('통합 분석 테스트: 김치찌개 + 타이레놀');
  console.log('===========================================\n');

  // 1. 레시피 DB에서 김치찌개 영양 정보 조회
  console.log('1️⃣  레시피 DB 조회...');
  const recipeUrl = `http://openapi.foodsafetykorea.go.kr/api/${RECIPE_KEY}/COOKRCP01/json/1/100`;
  
  try {
    const recipeRes = await axios.get(recipeUrl, { timeout: 10000 });
    
    if (recipeRes.data?.COOKRCP01?.row) {
      const allRecipes = recipeRes.data.COOKRCP01.row;
      const kimchiRecipes = allRecipes.filter(r => 
        r.RCP_NM?.includes('김치') || r.HASH_TAG?.includes('김치')
      );
      
      if (kimchiRecipes.length > 0) {
        const recipe = kimchiRecipes[0];
        console.log(`✅ 레시피 발견: ${recipe.RCP_NM}`);
        console.log(`   - 칼로리: ${recipe.INFO_ENG}kcal`);
        console.log(`   - 나트륨: ${recipe.INFO_NA}mg`);
        console.log(`   - 탄수화물: ${recipe.INFO_CAR}g`);
        console.log(`   - 단백질: ${recipe.INFO_PRO}g`);
        console.log(`   - 지방: ${recipe.INFO_FAT}g`);
        console.log(`   - 조리방법: ${recipe.RCP_WAY2}`);
        console.log(`   - 카테고리: ${recipe.RCP_PAT2}`);
        if (recipe.RCP_NA_TIP) {
          console.log(`   - 저염팁: ${recipe.RCP_NA_TIP}`);
        }
      } else {
        console.log('⚠️  김치 관련 레시피 없음');
      }
    }
  } catch (error) {
    console.error('❌ 레시피 API 오류:', error.message);
  }

  console.log('\n2️⃣  e약은요 API 조회 (타이레놀)...');
  const medicineUrl = 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList';
  
  try {
    const medicineRes = await axios.get(medicineUrl, {
      params: {
        serviceKey: SERVICE_KEY,
        itemName: '타이레놀',
        numOfRows: 3,
        pageNo: 1,
        type: 'json',
      },
      timeout: 10000,
    });

    if (medicineRes.data?.header?.resultCode === '00' && medicineRes.data?.body?.items) {
      const medicines = medicineRes.data.body.items;
      
      console.log(`✅ ${medicines.length}개 의약품 발견\n`);
      
      medicines.forEach((med, idx) => {
        console.log(`[${idx + 1}] ${med.itemName}`);
        console.log(`   제조사: ${med.entpName}`);
        
        // 음식 관련 주의사항 추출
        const precautions = med.atpnQesitm || '';
        const interactions = med.intrcQesitm || '';
        const warnings = med.atpnWarnQesitm || '';
        
        const foodKeywords = ['음주', '알코올', '음식', '식사', '공복', '식후'];
        const foundKeywords = foodKeywords.filter(k => 
          precautions.includes(k) || interactions.includes(k) || warnings.includes(k)
        );
        
        if (foundKeywords.length > 0) {
          console.log(`   🔍 음식 관련 키워드: ${foundKeywords.join(', ')}`);
        }
        
        if (interactions.includes('알코올') || interactions.includes('음주')) {
          console.log('   ⚠️  알코올 상호작용 주의');
        }
        
        console.log('');
      });
      
      // 첫 번째 약물의 상세 정보
      const med = medicines[0];
      console.log('\n📋 상세 정보 (첫 번째 약물):');
      console.log('효능:', med.efcyQesitm?.substring(0, 100) + '...');
      console.log('\n주의사항:', med.atpnQesitm?.substring(0, 200) + '...');
      
      if (med.intrcQesitm) {
        console.log('\n상호작용:', med.intrcQesitm?.substring(0, 200) + '...');
      }
      
    } else {
      console.log('⚠️  검색 결과 없음');
    }
  } catch (error) {
    console.error('❌ 의약품 API 오류:', error.message);
    if (error.response) {
      console.error('   상태:', error.response.status);
      console.error('   데이터:', error.response.data);
    }
  }

  console.log('\n===========================================');
  console.log('3️⃣  통합 분석 결과');
  console.log('===========================================');
  console.log('✅ 레시피 DB: 영양 성분 정보 제공 가능');
  console.log('✅ e약은요: 약물-음식 상호작용 주의사항 제공 가능');
  console.log('');
  console.log('💡 Gemini 분석 시 활용 가능한 정보:');
  console.log('   - 음식의 실제 영양 성분 (칼로리, 나트륨 등)');
  console.log('   - 약물의 공식 주의사항 및 상호작용 정보');
  console.log('   - 저염 조리법 팁 (레시피DB 제공)');
  console.log('   - 약물 복용 시 음식 섭취 주의사항');
  console.log('');
  console.log('🎯 다음 단계:');
  console.log('   1. Gemini가 이 공공데이터를 기반으로 1차 분석');
  console.log('   2. RAG 데이터와 비교하여 잘못된 부분 체크');
  console.log('   3. 최종 점수 및 권장사항 제공');
}

testIntegratedAnalysis().catch(console.error);
