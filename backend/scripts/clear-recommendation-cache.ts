#!/usr/bin/env ts-node

/**
 * 추천 캐시 초기화 스크립트
 * 
 * 기능:
 * 1. daily_recommendations 테이블 삭제 (오늘/전체 선택 가능)
 * 2. recommendation_global_cache 테이블 삭제 (글로벌 캐시)
 * 
 * 사용법:
 * npm run clear-recommendation -- --force
 * npm run clear-recommendation -- --force --today (오늘 것만)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env 파일 로드
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 환경 변수가 설정되지 않았습니다:');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function clearRecommendationCache(todayOnly: boolean) {
  console.log('🔄 추천 캐시 초기화를 시작합니다...\n');
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. daily_recommendations 테이블
    console.log('📦 [1/2] daily_recommendations 테이블 정리 중...');
    
    if (todayOnly) {
      console.log(`   📅 오늘(${today}) 데이터만 삭제합니다.`);
      const { error } = await supabase
        .from('daily_recommendations')
        .delete()
        .eq('date', today);
      
      if (error) {
        console.error('   ❌ 삭제 실패:', error.message);
      } else {
        console.log('   ✅ 오늘의 추천 캐시를 삭제했습니다.');
      }
    } else {
      const { data, error: countError } = await supabase
        .from('daily_recommendations')
        .select('id', { count: 'exact', head: false });
      
      const count = data?.length || 0;
      console.log(`   ℹ️  현재 항목 수: ${count}개`);
      
      if (count > 0) {
        const { error } = await supabase
          .from('daily_recommendations')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (error) {
          console.error('   ❌ 삭제 실패:', error.message);
        } else {
          console.log(`   ✅ ${count}개의 캐시 항목을 삭제했습니다.`);
        }
      } else {
        console.log('   ℹ️  삭제할 캐시가 없습니다.');
      }
    }

    console.log('');

    // 2. recommendation_global_cache 테이블
    console.log('🌍 [2/2] recommendation_global_cache 테이블 정리 중...');
    
    const { data: globalData, error: globalCountError } = await supabase
      .from('recommendation_global_cache')
      .select('id', { count: 'exact', head: false });
    
    const globalCount = globalData?.length || 0;
    console.log(`   ℹ️  현재 글로벌 캐시 항목 수: ${globalCount}개`);
    
    if (globalCount > 0) {
      const { error } = await supabase
        .from('recommendation_global_cache')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        console.error('   ❌ 글로벌 캐시 삭제 실패:', error.message);
      } else {
        console.log(`   ✅ ${globalCount}개의 글로벌 캐시 항목을 삭제했습니다.`);
      }
    } else {
      console.log('   ℹ️  삭제할 글로벌 캐시가 없습니다.');
    }

    console.log('\n✨ 추천 캐시 초기화가 완료되었습니다!\n');
    console.log('💡 앱에서 "내 추천" 페이지에 다시 접속하면 새 추천이 생성됩니다.');
    console.log('   (imageUrl, relatedLink가 포함된 새 데이터가 생성됩니다)');

  } catch (error) {
    console.error('❌ 캐시 초기화 중 오류 발생:', error);
    process.exit(1);
  }
}

// 인자 파싱
const args = process.argv.slice(2);
const forceFlag = args.includes('--force') || args.includes('-f');
const todayOnly = args.includes('--today') || args.includes('-t');

if (!forceFlag) {
  console.log('⚠️  경고: 이 작업은 다음 데이터를 삭제합니다:');
  console.log('   - daily_recommendations 테이블의 캐시');
  console.log('   - recommendation_global_cache 테이블의 글로벌 캐시');
  console.log('');
  console.log('계속하려면 --force 또는 -f 플래그를 추가하세요:');
  console.log('   npx ts-node scripts/clear-recommendation-cache.ts --force');
  console.log('');
  console.log('오늘 데이터만 삭제하려면:');
  console.log('   npx ts-node scripts/clear-recommendation-cache.ts --force --today');
  process.exit(0);
}

clearRecommendationCache(todayOnly)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
