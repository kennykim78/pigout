#!/usr/bin/env ts-node

/**
 * DB 캐시 초기화 스크립트
 * 
 * 기능:
 * 1. medicine_cache 테이블 전체 삭제 (약품 검색 캐시)
 * 2. medicine_records 테이블의 qr_code_data.aiAnalyzedInfo 초기화 (AI 분석 캐시)
 * 
 * 사용법:
 * npm run clear-cache
 * 
 * 또는:
 * npx ts-node scripts/clear-cache.ts
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

async function clearCache() {
  console.log('🔄 DB 캐시 초기화를 시작합니다...\n');

  try {
    // 1. medicine_cache 테이블 전체 삭제
    console.log('📦 [1/2] medicine_cache 테이블 정리 중...');
    const { data: cacheData, error: cacheError } = await supabase
      .from('medicine_cache')
      .select('id', { count: 'exact', head: false });

    if (cacheError) {
      console.error('   ❌ 캐시 조회 실패:', cacheError.message);
    } else {
      const cacheCount = cacheData?.length || 0;
      console.log(`   ℹ️  현재 캐시 항목 수: ${cacheCount}개`);

      if (cacheCount > 0) {
        const { error: deleteError } = await supabase
          .from('medicine_cache')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 행 삭제

        if (deleteError) {
          console.error('   ❌ 캐시 삭제 실패:', deleteError.message);
        } else {
          console.log(`   ✅ ${cacheCount}개의 캐시 항목을 삭제했습니다.`);
        }
      } else {
        console.log('   ℹ️  삭제할 캐시가 없습니다.');
      }
    }

    console.log('');

    // 2. medicine_records의 qr_code_data.aiAnalyzedInfo 초기화
    console.log('💊 [2/2] medicine_records AI 분석 캐시 초기화 중...');
    
    // 먼저 aiAnalyzedInfo가 있는 레코드 조회
    const { data: recordsData, error: recordsError } = await supabase
      .from('medicine_records')
      .select('id, name, qr_code_data')
      .not('qr_code_data', 'is', null);

    if (recordsError) {
      console.error('   ❌ 약품 레코드 조회 실패:', recordsError.message);
    } else {
      const records = recordsData || [];
      let updateCount = 0;

      for (const record of records) {
        try {
          const qrData = typeof record.qr_code_data === 'string' 
            ? JSON.parse(record.qr_code_data) 
            : record.qr_code_data;

          if (qrData && qrData.aiAnalyzedInfo) {
            // aiAnalyzedInfo 제거
            delete qrData.aiAnalyzedInfo;

            const { error: updateError } = await supabase
              .from('medicine_records')
              .update({ qr_code_data: JSON.stringify(qrData) })
              .eq('id', record.id);

            if (updateError) {
              console.error(`   ⚠️  ${record.name} AI 캐시 제거 실패:`, updateError.message);
            } else {
              updateCount++;
              console.log(`   ✅ ${record.name} - AI 분석 캐시 제거`);
            }
          }
        } catch (parseError) {
          console.error(`   ⚠️  ${record.name} qr_code_data 파싱 실패:`, parseError.message);
        }
      }

      console.log(`   ✅ 총 ${updateCount}개의 약품 AI 캐시를 초기화했습니다.`);
    }

    console.log('\n✨ 캐시 초기화가 완료되었습니다!\n');
    console.log('📝 초기화된 항목:');
    console.log('   - medicine_cache: 약품 검색 캐시');
    console.log('   - medicine_records.qr_code_data.aiAnalyzedInfo: AI 분석 캐시');
    console.log('');
    console.log('💡 새로 약품을 등록하면 AI 분석이 다시 수행됩니다.');

  } catch (error) {
    console.error('❌ 캐시 초기화 중 오류 발생:', error);
    process.exit(1);
  }
}

// 확인 프롬프트 (선택 사항)
const args = process.argv.slice(2);
const forceFlag = args.includes('--force') || args.includes('-f');

if (!forceFlag) {
  console.log('⚠️  경고: 이 작업은 다음 데이터를 삭제합니다:');
  console.log('   - medicine_cache 테이블의 모든 캐시');
  console.log('   - medicine_records의 AI 분석 캐시');
  console.log('');
  console.log('계속하려면 --force 또는 -f 플래그를 추가하세요:');
  console.log('   npm run clear-cache -- --force');
  console.log('   또는');
  console.log('   npx ts-node scripts/clear-cache.ts --force');
  process.exit(0);
}

clearCache()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
