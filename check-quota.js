import axios from 'axios';

// 환경변수나 직접 입력
const MAIN_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_MAIN_KEY';
const BACKUP_API_KEY = process.env.GEMINI_API_KEY_BACKUP || 'YOUR_BACKUP_KEY';

async function checkQuota(apiKey, keyName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      parts: [{ text: 'test' }]
    }]
  };

  try {
    console.log(`\n[${keyName}] 테스트 중...`);
    const response = await axios.post(url, payload, { 
      timeout: 10000,
      validateStatus: null // 모든 상태 코드 허용
    });
    
    if (response.status === 200) {
      console.log(`✅ [${keyName}] 정상 작동 (Status: ${response.status})`);
      console.log(`   - 사용 토큰: ${response.data.usageMetadata?.totalTokenCount || 0}`);
      return { status: 'active', keyName };
    } else if (response.status === 429) {
      const errorMsg = JSON.stringify(response.data);
      console.log(`❌ [${keyName}] 할당량 소진 (Status: 429)`);
      console.log(`   - 에러: ${errorMsg.substring(0, 200)}`);
      
      // 에러 타입 분석
      if (errorMsg.includes('limit: 0')) {
        console.log(`   - 타입: 완전 소진 (limit: 0)`);
      } else if (errorMsg.includes('PerMinute')) {
        console.log(`   - 타입: 분당 요청 제한`);
      } else if (errorMsg.includes('PerDay')) {
        console.log(`   - 타입: 일일 한도 도달`);
      }
      return { status: 'quota_exceeded', keyName, error: response.data };
    } else {
      console.log(`⚠️  [${keyName}] 예상치 못한 응답 (Status: ${response.status})`);
      console.log(`   - 응답: ${JSON.stringify(response.data).substring(0, 200)}`);
      return { status: 'error', keyName, code: response.status };
    }
  } catch (error) {
    if (error.response?.status === 429) {
      console.log(`❌ [${keyName}] 할당량 소진 (Status: 429)`);
      const errorMsg = JSON.stringify(error.response.data);
      console.log(`   - 에러: ${errorMsg.substring(0, 200)}`);
      return { status: 'quota_exceeded', keyName };
    } else {
      console.log(`❌ [${keyName}] 오류 발생: ${error.message}`);
      return { status: 'error', keyName, message: error.message };
    }
  }
}

async function main() {
  console.log('=================================================');
  console.log('  Gemini API 할당량 체크');
  console.log('=================================================');
  console.log(`현재 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  console.log(`할당량 리셋: 매일 KST 09:00 (UTC 00:00)`);
  console.log('=================================================');

  const results = [];
  
  // 메인 키 체크
  if (MAIN_API_KEY && MAIN_API_KEY !== 'YOUR_MAIN_KEY') {
    const result = await checkQuota(MAIN_API_KEY, '메인 키');
    results.push(result);
  } else {
    console.log('\n⚠️  메인 API 키가 설정되지 않았습니다.');
  }

  // 백업 키 체크
  if (BACKUP_API_KEY && BACKUP_API_KEY !== 'YOUR_BACKUP_KEY') {
    const result = await checkQuota(BACKUP_API_KEY, '백업 키');
    results.push(result);
  } else {
    console.log('\n⚠️  백업 API 키가 설정되지 않았습니다.');
  }

  // 요약
  console.log('\n=================================================');
  console.log('  요약');
  console.log('=================================================');
  const activeCount = results.filter(r => r.status === 'active').length;
  const quotaExceeded = results.filter(r => r.status === 'quota_exceeded').length;
  
  console.log(`✅ 정상 작동: ${activeCount}개 키`);
  console.log(`❌ 할당량 소진: ${quotaExceeded}개 키`);
  
  if (activeCount > 0) {
    console.log('\n🎉 최소 1개 이상의 키가 정상 작동 중입니다!');
  } else if (quotaExceeded > 0) {
    console.log('\n⏰ 모든 키가 할당량을 소진했습니다. 내일 KST 09:00에 리셋됩니다.');
  }
  
  console.log('=================================================\n');
}

main().catch(console.error);
