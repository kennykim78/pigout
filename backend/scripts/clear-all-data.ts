#!/usr/bin/env ts-node

/**
 * medicine_records 테이블 전체 삭제 스크립트
 * 
 * ⚠️  경고: 이 스크립트는 사용자가 등록한 모든 약품 데이터를 삭제합니다!
 * 
 * 삭제되는 데이터:
 * - medicine_records: 사용자가 등록한 모든 약품
 * - medicine_cache: 약품 검색 캐시
 * 
 * 사용법:
 * npm run clear-all -- --force
 * 
 * 또는:
 * npx ts-node scripts/clear-all-data.ts --force
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

async function clearAllData() {
  console.log('🔥 모든 약품 데이터 삭제를 시작합니다...\n');

  try {
    // 1. medicine_records 테이블 전체 삭제
    console.log('💊 [1/2] medicine_records 테이블 전체 삭제 중...');
    const { data: recordsData, error: recordsError } = await supabase
      .from('medicine_records')
      .select('id, name', { count: 'exact', head: false });

    if (recordsError) {
      console.error('   ❌ 약품 레코드 조회 실패:', recordsError.message);
    } else {
      const recordsCount = recordsData?.length || 0;
      console.log(`   ℹ️  현재 등록된 약품 수: ${recordsCount}개`);

      if (recordsCount > 0) {
        const { error: deleteError } = await supabase
          .from('medicine_records')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 행 삭제

        if (deleteError) {
          console.error('   ❌ 약품 레코드 삭제 실패:', deleteError.message);
        } else {
          console.log(`   ✅ ${recordsCount}개의 약품 레코드를 삭제했습니다.`);
        }
      } else {
        console.log('   ℹ️  삭제할 약품이 없습니다.');
      }
    }

    console.log('');

    // 2. medicine_cache 테이블 전체 삭제
    console.log('📦 [2/2] medicine_cache 테이블 전체 삭제 중...');
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

    console.log('\n✨ 모든 데이터 삭제가 완료되었습니다!\n');
    console.log('📝 삭제된 항목:');
    console.log('   - medicine_records: 사용자 등록 약품');
    console.log('   - medicine_cache: 약품 검색 캐시');
    console.log('');
    console.log('💡 이제 새로운 약품을 등록할 수 있습니다.');

  } catch (error) {
    console.error('❌ 데이터 삭제 중 오류 발생:', error);
    process.exit(1);
  }
}

// 확인 프롬프트 (필수)
const args = process.argv.slice(2);
const forceFlag = args.includes('--force') || args.includes('-f');

if (!forceFlag) {
  console.log('⚠️  ⚠️  ⚠️  경고 ⚠️  ⚠️  ⚠️');
  console.log('');
  console.log('이 작업은 다음 데이터를 영구적으로 삭제합니다:');
  console.log('   - medicine_records: 사용자가 등록한 모든 약품 데이터');
  console.log('   - medicine_cache: 모든 검색 캐시');
  console.log('');
  console.log('⚠️  이 작업은 되돌릴 수 없습니다!');
  console.log('');
  console.log('계속하려면 --force 또는 -f 플래그를 추가하세요:');
  console.log('   npm run clear-all -- --force');
  console.log('   또는');
  console.log('   npx ts-node scripts/clear-all-data.ts --force');
  process.exit(0);
}

clearAllData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
