/**
 * 14개 질병의 강화 정보를 미리 생성하여 DB에 저장하는 스크립트
 * 
 * 실행 방법:
 * cd backend
 * npx ts-node scripts/generate-disease-data.ts
 */

import { GeminiClient } from '../src/ai/utils/gemini.client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const diseases = [
  '탈모', '당뇨', '고혈압', '고지혈증', '통풍', '감기', '비염',
  '위염', '지방간', '비만', '변비', '빈혈', '암', '여드름'
];

async function generateAndSaveDiseaseData() {
  console.log('🚀 질병 강화 정보 생성 시작...\n');

  // Gemini 클라이언트 초기화
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }
  const geminiClient = new GeminiClient(geminiApiKey);

  // Supabase 클라이언트 초기화
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL 또는 SUPABASE_KEY가 설정되지 않았습니다.');
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  let successCount = 0;
  let failCount = 0;

  for (const disease of diseases) {
    try {
      console.log(`📝 [${diseases.indexOf(disease) + 1}/${diseases.length}] ${disease} 생성 중...`);

      // AI로 강화 정보 생성
      const enhancedInfo = await geminiClient.generateDiseaseEnhancedInfo(disease);

      // DB에 저장
      const { data, error } = await supabase
        .from('disease_enhanced_info')
        .upsert(
          {
            disease_name: disease,
            category: enhancedInfo.category,
            severity: enhancedInfo.severity,
            chronic_type: enhancedInfo.chronicType,
            tags: enhancedInfo.tags,
            recommended_foods: enhancedInfo.recommendedFoods,
            avoid_foods: enhancedInfo.avoidFoods,
            caution_foods: enhancedInfo.cautionFoods,
            dietary_reason: enhancedInfo.dietaryReason,
            key_nutrients: enhancedInfo.keyNutrients,
            complication_risks: enhancedInfo.complicationRisks,
            general_precautions: enhancedInfo.generalPrecautions,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'disease_name',
          }
        )
        .select();

      if (error) {
        console.error(`   ❌ 저장 실패: ${error.message}`);
        failCount++;
      } else {
        console.log(`   ✅ 저장 완료 (ID: ${data[0].id})`);
        console.log(`   📊 카테고리: ${enhancedInfo.category}, 심각도: ${enhancedInfo.severity}`);
        console.log(`   🥗 권장 음식: ${enhancedInfo.recommendedFoods.slice(0, 3).join(', ')}...`);
        console.log(`   🚫 피할 음식: ${enhancedInfo.avoidFoods.slice(0, 3).join(', ')}...\n`);
        successCount++;
      }

      // Rate limiting 방지 (1초 대기)
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`   ❌ 오류 발생: ${error.message}\n`);
      failCount++;
    }
  }

  console.log('\n🎉 완료!');
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log(`📊 총계: ${diseases.length}개`);
}

// 실행
generateAndSaveDiseaseData()
  .then(() => {
    console.log('\n프로그램 종료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 치명적 오류:', error);
    process.exit(1);
  });
