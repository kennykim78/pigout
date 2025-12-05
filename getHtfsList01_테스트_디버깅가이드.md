# getHtfsList01 API 테스트 및 디버깅 가이드

## 🧪 실전 테스트 방법

### 1️⃣ cURL을 사용한 직접 테스트

#### 기본 테스트 (전체 목록, 최초 3개)
```bash
curl -X GET \
  "https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01?serviceKey=YOUR_SERVICE_KEY&pageNo=1&numOfRows=3&type=json" \
  -H "Accept: application/json"
```

#### 제품명으로 검색
```bash
curl -X GET \
  "https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01?serviceKey=YOUR_SERVICE_KEY&prdlst_nm=비타민&pageNo=1&numOfRows=10&type=json" \
  -H "Accept: application/json"
```

#### 원료명으로 검색
```bash
curl -X GET \
  "https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01?serviceKey=YOUR_SERVICE_KEY&rawmtrl_nm=유산균&pageNo=1&numOfRows=10&type=json" \
  -H "Accept: application/json"
```

#### 업체명으로 검색
```bash
curl -X GET \
  "https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01?serviceKey=YOUR_SERVICE_KEY&entrps=종로약&pageNo=1&numOfRows=10&type=json" \
  -H "Accept: application/json"
```

---

### 2️⃣ PowerShell에서 테스트 (Windows)

#### 기본 테스트
```powershell
$serviceKey = "YOUR_SERVICE_KEY"
$url = "https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01"

$params = @{
  serviceKey = $serviceKey
  pageNo = 1
  numOfRows = 3
  type = "json"
}

$response = Invoke-WebRequest -Uri $url -Method GET -Body $params
$result = $response.Content | ConvertFrom-Json
$result | ConvertTo-Json -Depth 5
```

#### 제품명 검색
```powershell
$serviceKey = "YOUR_SERVICE_KEY"
$url = "https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01"

$params = @{
  serviceKey = $serviceKey
  prdlst_nm = "비타민"
  pageNo = 1
  numOfRows = 10
  type = "json"
}

$response = Invoke-WebRequest -Uri $url -Method GET -Body $params
$result = $response.Content | ConvertFrom-Json

# 결과 확인
Write-Host "총 건수: $($result.body.totalCount)"
Write-Host "조회 건수: $($result.body.numOfRows)"
Write-Host ""

# 첫 3개 항목만 출력
$result.body.items | Select-Object -First 3 | ForEach-Object {
  $item = $_.item
  Write-Host "제품명: $($item.PRDUCT)"
  Write-Host "업체: $($item.ENTRPS)"
  Write-Host "기능성: $($item.MAIN_FNCTN)"
  Write-Host "---"
}
```

---

### 3️⃣ Node.js/JavaScript에서 테스트

#### axios 사용 (추천)
```javascript
const axios = require('axios');

async function testGetHtfsList01() {
  const SERVICE_KEY = 'YOUR_SERVICE_KEY';
  const url = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01';

  try {
    // 테스트 1: 기본 조회
    console.log('=== 테스트 1: 기본 조회 ===');
    let response = await axios.get(url, {
      params: {
        serviceKey: SERVICE_KEY,
        pageNo: 1,
        numOfRows: 3,
        type: 'json'
      },
      timeout: 10000
    });
    console.log('상태:', response.data.header.resultCode);
    console.log('메시지:', response.data.header.resultMsg);
    console.log('조회 건수:', response.data.body.items.length);
    console.log('');

    // 테스트 2: 제품명 검색
    console.log('=== 테스트 2: 제품명 검색 (비타민) ===');
    response = await axios.get(url, {
      params: {
        serviceKey: SERVICE_KEY,
        prdlst_nm: '비타민',
        pageNo: 1,
        numOfRows: 5,
        type: 'json'
      },
      timeout: 10000
    });
    console.log('상태:', response.data.header.resultCode);
    console.log('조회 건수:', response.data.body.items.length);
    console.log('전체 결과 수:', response.data.body.totalCount);
    
    if (response.data.body.items.length > 0) {
      const item = response.data.body.items[0].item;
      console.log('첫 번째 결과:');
      console.log('  제품명:', item.PRDUCT);
      console.log('  업체:', item.ENTRPS);
      console.log('  기능성:', item.MAIN_FNCTN);
      console.log('  신고번호:', item.STTEMNT_NO);
    }
    console.log('');

    // 테스트 3: 원료명 검색
    console.log('=== 테스트 3: 원료명 검색 (유산균) ===');
    response = await axios.get(url, {
      params: {
        serviceKey: SERVICE_KEY,
        rawmtrl_nm: '유산균',
        pageNo: 1,
        numOfRows: 5,
        type: 'json'
      },
      timeout: 10000
    });
    console.log('상태:', response.data.header.resultCode);
    console.log('조회 건수:', response.data.body.items.length);
    console.log('전체 결과 수:', response.data.body.totalCount);
    console.log('');

    // 테스트 4: 응답 구조 확인
    console.log('=== 테스트 4: 응답 구조 확인 ===');
    response = await axios.get(url, {
      params: {
        serviceKey: SERVICE_KEY,
        pageNo: 1,
        numOfRows: 1,
        type: 'json'
      },
      timeout: 10000
    });
    
    if (response.data.body.items.length > 0) {
      const item = response.data.body.items[0].item;
      console.log('Item 필드:');
      console.log(JSON.stringify(Object.keys(item).sort(), null, 2));
      console.log('');
      console.log('전체 데이터:');
      console.log(JSON.stringify(item, null, 2));
    }

  } catch (error) {
    console.error('오류:', error.message);
    if (error.response) {
      console.error('상태 코드:', error.response.status);
      console.error('응답 데이터:', error.response.data);
    }
  }
}

testGetHtfsList01();
```

---

## 🔍 응답 데이터 필드 검증 도구

### 필드 매핑 테스트
```javascript
const axios = require('axios');

async function validateResponseFields() {
  const SERVICE_KEY = 'YOUR_SERVICE_KEY';
  const url = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01';

  try {
    // 여러 검색어로 테스트하여 다양한 필드 발견
    const keywords = ['비타민', '유산균', '오메가3', '홍삼', '칼슘'];
    const allFields = new Set();
    const fieldStats = {};

    for (const keyword of keywords) {
      console.log(`\n테스트: ${keyword}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: SERVICE_KEY,
          prdlst_nm: keyword,
          pageNo: 1,
          numOfRows: 3,
          type: 'json'
        },
        timeout: 10000
      });

      const items = response.data.body.items || [];
      console.log(`조회 건수: ${items.length}`);

      items.forEach((wrapper, index) => {
        const item = wrapper.item;
        Object.keys(item).forEach(field => {
          allFields.add(field);
          fieldStats[field] = (fieldStats[field] || 0) + 1;
        });

        if (index === 0) {
          console.log('필드 샘플:');
          Object.entries(item).slice(0, 5).forEach(([k, v]) => {
            console.log(`  ${k}: ${String(v).substring(0, 50)}`);
          });
        }
      });
    }

    console.log('\n=== 필드 통계 ===');
    console.log(`발견된 필드 총 개수: ${allFields.size}`);
    console.log('\n필드별 출현 횟수:');
    
    Object.entries(fieldStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([field, count]) => {
        const percentage = Math.round((count / keywords.length) * 100);
        console.log(`  ${field}: ${count}/${keywords.length} (${percentage}%)`);
      });

    console.log('\n모든 필드:');
    console.log(Array.from(allFields).sort().join(', '));

  } catch (error) {
    console.error('오류:', error.message);
  }
}

validateResponseFields();
```

---

## 🐛 디버깅 팁

### 1️⃣ 응답 전체 확인하기
```typescript
// 로깅 유틸리티
function debugResponse(data: any) {
  console.log('=== 전체 응답 ===');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\n=== Header 정보 ===');
  console.log(`resultCode: ${data.header?.resultCode}`);
  console.log(`resultMsg: ${data.header?.resultMsg}`);
  
  console.log('\n=== Body 정보 ===');
  console.log(`pageNo: ${data.body?.pageNo}`);
  console.log(`numOfRows: ${data.body?.numOfRows}`);
  console.log(`totalCount: ${data.body?.totalCount}`);
  console.log(`items 개수: ${data.body?.items?.length}`);
  
  console.log('\n=== 첫 번째 Item ===');
  if (data.body?.items?.[0]) {
    console.log(JSON.stringify(data.body.items[0], null, 2));
  }
}

// 사용
const response = await axios.get(url, { params });
debugResponse(response.data);
```

### 2️⃣ 파라미터 검증
```typescript
function validateParams(params: any) {
  const validParams = [
    'serviceKey', 'pageNo', 'numOfRows', 'type',
    'prdlst_nm', 'rawmtrl_nm', 'entrps'
  ];
  
  console.log('=== 요청 파라미터 ===');
  Object.entries(params).forEach(([key, value]) => {
    const isValid = validParams.includes(key);
    const status = isValid ? '✅' : '⚠️ 미검증';
    console.log(`${status} ${key}: ${value}`);
  });
}

// 사용
validateParams({ serviceKey, prdlst_nm: '비타민', pageNo: 1, numOfRows: 10 });
```

### 3️⃣ 필드 존재 여부 확인
```typescript
function checkFieldExistence(items: any[]) {
  const fieldMatrix: Record<string, boolean[]> = {};
  
  items.forEach((wrapper, itemIndex) => {
    const item = wrapper.item;
    Object.keys(item).forEach(field => {
      if (!fieldMatrix[field]) {
        fieldMatrix[field] = [];
      }
      fieldMatrix[field][itemIndex] = !!item[field] && item[field].toString().trim() !== '';
    });
  });
  
  console.log('=== 필드 존재 여부 (항목별) ===');
  Object.entries(fieldMatrix).forEach(([field, existence]) => {
    const count = existence.filter(Boolean).length;
    const percentage = Math.round((count / existence.length) * 100);
    console.log(`${field}: ${count}/${existence.length} (${percentage}%)`);
  });
}

// 사용
checkFieldExistence(response.data.body.items);
```

---

## 📊 성능 테스트

### 응답 시간 측정
```javascript
async function benchmarkApi() {
  const SERVICE_KEY = 'YOUR_SERVICE_KEY';
  const url = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01';
  
  const tests = [
    { label: '기본 조회 (최초 10개)', params: { pageNo: 1, numOfRows: 10 } },
    { label: '제품명 검색 (비타민)', params: { prdlst_nm: '비타민', pageNo: 1, numOfRows: 10 } },
    { label: '원료명 검색 (유산균)', params: { rawmtrl_nm: '유산균', pageNo: 1, numOfRows: 10 } },
    { label: '대량 조회 (100개)', params: { pageNo: 1, numOfRows: 100 } },
    { label: '두 번째 페이지', params: { pageNo: 2, numOfRows: 10 } },
  ];

  console.log('=== 성능 테스트 ===\n');

  for (const test of tests) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(url, {
        params: {
          serviceKey: SERVICE_KEY,
          type: 'json',
          ...test.params
        },
        timeout: 15000
      });
      
      const duration = Date.now() - startTime;
      const itemCount = response.data.body.items.length;
      const avgPerItem = Math.round(duration / itemCount);
      
      console.log(`${test.label}`);
      console.log(`  응답 시간: ${duration}ms`);
      console.log(`  조회 항목: ${itemCount}개`);
      console.log(`  항목당 평균: ${avgPerItem}ms`);
      console.log('');
      
    } catch (error) {
      console.log(`${test.label}: ❌ 오류 - ${error.message}`);
      console.log('');
    }
  }
}

benchmarkApi();
```

---

## 🔄 상세 정보 조회 테스트

### getHtfsItem01 API 테스트
```javascript
async function testDetailedInfo() {
  const SERVICE_KEY = 'YOUR_SERVICE_KEY';
  const baseUrl = 'https://apis.data.go.kr/1471000/HtfsInfoService03';

  try {
    // 1단계: 목록에서 신고번호 얻기
    console.log('=== 1단계: 목록 조회 ===');
    const listResponse = await axios.get(`${baseUrl}/getHtfsList01`, {
      params: {
        serviceKey: SERVICE_KEY,
        prdlst_nm: '비타민',
        pageNo: 1,
        numOfRows: 1,
        type: 'json'
      },
      timeout: 10000
    });

    const item = listResponse.data.body.items[0].item;
    const reportNo = item.STTEMNT_NO;
    
    console.log(`신고번호: ${reportNo}`);
    console.log(`제품명: ${item.PRDUCT}`);
    console.log('');

    // 2단계: 상세 정보 조회
    console.log('=== 2단계: 상세 정보 조회 ===');
    const detailResponse = await axios.get(`${baseUrl}/getHtfsItem01`, {
      params: {
        serviceKey: SERVICE_KEY,
        sttemnt_no: reportNo,
        type: 'json'
      },
      timeout: 10000
    });

    console.log('상태:', detailResponse.data.header.resultCode);
    console.log('메시지:', detailResponse.data.header.resultMsg);
    
    if (detailResponse.data.body?.items?.length > 0) {
      const detailedItem = detailResponse.data.body.items[0].item;
      console.log('\n상세 정보 필드:');
      Object.entries(detailedItem).forEach(([key, value]) => {
        console.log(`  ${key}: ${String(value).substring(0, 100)}`);
      });
    }

  } catch (error) {
    console.error('오류:', error.message);
  }
}

testDetailedInfo();
```

---

## 🎯 실무 체크리스트

### API 통합 전 확인사항
- [ ] serviceKey 정상 작동 확인
- [ ] 기본 조회 응답 확인
- [ ] 제품명 필터링 결과 확인
- [ ] 원료명 필터링 결과 확인
- [ ] 응답 시간 < 10초 확인
- [ ] 에러 응답 처리 확인
- [ ] 페이지네이션 작동 확인
- [ ] 필드명 매핑 정확성 확인
- [ ] 상세 정보 조회 가능 여부 확인
- [ ] API 일일 한도 정보 확인

### 배포 전 최종 테스트
```javascript
async function finalValidation() {
  const tests = [
    { name: '기본 조회', fn: testBasicSearch },
    { name: '제품명 검색', fn: () => testSearch('prdlst_nm', '비타민') },
    { name: '원료명 검색', fn: () => testSearch('rawmtrl_nm', '유산균') },
    { name: '업체명 검색', fn: () => testSearch('entrps', '종로약') },
    { name: '에러 처리', fn: testErrorHandling },
    { name: '타임아웃 처리', fn: testTimeout },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name} 통과`);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name} 실패: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n최종 결과: ${passed}/${passed + failed} 통과`);
  return failed === 0;
}
```

---

## 📞 문제 해결

### Q: 항상 같은 결과만 나온다
**A**: API 캐싱 또는 서버 캐시 가능성. 다른 페이지 번호나 검색어로 테스트

### Q: 응답이 너무 느리다
**A**: 
- numOfRows 감소
- 네트워크 지연 확인
- 타임아웃 값 증가 (최대 30초)

### Q: 필터링 결과가 정확하지 않다
**A**: 
- API 자체 필터링이 부정확할 수 있음
- 클라이언트에서 추가 필터링 필요
- 원료명/제품명이 다를 수 있음

### Q: 특정 필드가 없다
**A**:
- 모든 필드가 모든 상품에 있지 않음
- 필드 존재 여부 확인 필요
- null 체크 추가

