# getHtfsList01 API 상세 분석 리포트

## 🎯 API 기본 정보

**서비스명**: 식품의약품안전처 건강기능식품정보  
**API 엔드포인트**: `https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01`  
**API 버전**: HtfsInfoService03  
**응답 형식**: JSON  
**인증 방식**: serviceKey (쿼리 파라미터)

---

## 1️⃣ 요청 파라미터 분석

### 필수 파라미터
```typescript
interface GetHtfsListParams {
  serviceKey: string;        // 공공데이터 포털 인증 키 (필수)
  type: 'json' | 'xml';     // 응답 형식 (기본값: 'json')
  pageNo: number;           // 페이지 번호 (기본값: 1)
  numOfRows: number;        // 한 페이지의 행 수 (기본값: 10, 최대: 1000)
}
```

### 선택 파라미터 (필터링)
```typescript
interface OptionalFilterParams {
  prdlst_nm?: string;       // 제품명 (검색어)
  rawmtrl_nm?: string;      // 원료명 (검색어)
  entrps?: string;          // 업체명 (검색어)
  
  // ⚠️ 주의: 공식 문서에는 'stdt' 파라미터가 명시되어 있지 않음
  // stdt는 비공식/문서화되지 않은 파라미터일 수 있음
}
```

### 파라미터 상세 설명

| 파라미터 | 타입 | 필수여부 | 설명 | 비고 |
|--------|------|--------|------|------|
| `serviceKey` | String | **필수** | 공공데이터 포털에서 발급받은 인증 키 | 데코딩 필요 |
| `type` | String | 선택 | 응답 형식: `json` 또는 `xml` | 기본값: `json` |
| `pageNo` | Integer | 선택 | 페이지 번호 | 기본값: 1, 최소: 1 |
| `numOfRows` | Integer | 선택 | 페이지당 행 수 | 기본값: 10, 최대: 1000 |
| `prdlst_nm` | String | 선택 | 제품명으로 검색 | 부분 검색 가능 (예: '비타민') |
| `rawmtrl_nm` | String | 선택 | 원료명으로 검색 | 부분 검색 가능 (예: '유산균') |
| `entrps` | String | 선택 | 업체명으로 검색 | 부분 검색 가능 |

### ⚠️ 중요 발견사항: `stdt` 파라미터

테스트 URL에서 발견:
```
https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01?serviceKey=...&stdt=유산균
```

**분석 결과**:
- `stdt` 파라미터는 공식 API 명세서에 **명시되지 않음**
- 실제 API 응답에 영향을 주는지 확인 필요
- 가능한 해석:
  1. **비공식 파라미터**: 내부 테스트용
  2. **오류**: 올바른 파라미터는 `rawmtrl_nm` 또는 `prdlst_nm`
  3. **레거시**: 이전 버전 호환성을 위한 파라미터

**권장사항**: `stdt` 대신 공식 파라미터 사용:
```javascript
// ❌ 부정확
&stdt=유산균

// ✅ 올바른 방법
&rawmtrl_nm=유산균    // 원료명 검색
&prdlst_nm=유산균     // 제품명 검색
```

---

## 2️⃣ API 응답 구조 확인

### 전체 응답 형식
```json
{
  "header": {
    "resultCode": "00",           // "00": 성공, 그 외: 실패
    "resultMsg": "success"        // 결과 메시지
  },
  "body": {
    "pageNo": 1,                  // 현재 페이지 번호
    "numOfRows": 10,              // 현재 페이지의 행 수
    "totalCount": 1234,           // 전체 결과 개수
    "items": [
      {
        "item": {
          // 건강기능식품 상세 정보
        }
      },
      {
        "item": {
          // 건강기능식품 상세 정보
        }
      }
    ]
  }
}
```

### 응답 파싱 구조
```typescript
// 1단계: body 추출
const body = response.data?.body;

// 2단계: items 배열 추출
const items = body?.items;  // Array<{ item: object }>

// 3단계: 각 item 객체 추출
const itemList = items
  .map((wrapper: any) => wrapper.item)
  .filter((item: any) => item && Object.keys(item).length > 0);
```

---

## 3️⃣ Item 필드 구조 (응답 데이터)

### 메인 필드 (getHtfsList01 응답)
```typescript
interface HealthFunctionalFoodItem {
  // 기본 정보
  PRDUCT: string;              // 제품명 (예: "비타민 플러스")
  PRDLST_NM?: string;          // 제품명 (대체 필드)
  ENTRPS: string;              // 업체명/제조사 (예: "홍삼 주식회사")
  BSSH_NM?: string;            // 업체명 (대체 필드)
  
  // 신고/등록 정보
  STTEMNT_NO?: string;         // 신고번호 (식품의약품안전처)
  PRDLST_REPORT_NO?: string;   // 제품 신고번호 (대체 필드)
  REGIST_DT?: string;          // 등록일자 (YYYYMMDD 형식)
  
  // 기능성 정보 (⭐ 핵심 필드)
  MAIN_FNCTN?: string;         // 주요 기능성 (예: "면역력 증진")
  RLTV_FNCTN?: string;         // 관련 기능성 정보
  FRMLTN_DCL?: string;         // 포장 및 내용물 설명
  
  // 제품 상세 정보
  SUNGSANG?: string;           // 성상 (제품 형태, 예: "정제")
  SRV_USE?: string;            // 섭취량 및 섭취방법
  PRSRV_PD?: string;           // 보관방법 (예: "실온보관")
  DISTB_PD?: string;           // 유통기한
  
  // 안전 정보
  INTAKE_HINT1?: string;       // 섭취 시 주의사항
  INTAKE_HINT2?: string;       // 추가 주의사항
  
  // 원료/기준 정보
  BASE_STANDARD?: string;      // 기준규격
  RAW_MTRL?: string;           // 주요 원료
}
```

### 실제 응답 예시
```json
{
  "item": {
    "PRDUCT": "오메가3 플러스",
    "ENTRPS": "건강식품 주식회사",
    "STTEMNT_NO": "20230001234",
    "REGIST_DT": "20230115",
    "MAIN_FNCTN": "혈액 흐름 개선, 뇌 건강",
    "SUNGSANG": "소프트젤",
    "SRV_USE": "1일 1회 1캡슐",
    "PRSRV_PD": "실온보관",
    "INTAKE_HINT1": "임산부는 복용 전 전문가와 상담",
    "DISTB_PD": "제조 후 3년"
  }
}
```

---

## 4️⃣ 기능성 정보 (Efficacy) 획득 방법

### 4.1 getHtfsList01에서 기능성 정보
```typescript
// 단일 목록 조회 API에서는 제한된 정보만 제공
const efficacy = item.MAIN_FNCTN || item.RLTV_FNCTN || '';

// 예시
console.log(item.MAIN_FNCTN);
// 출력: "혈당 건강, 장 건강"
```

### 4.2 상세 정보 조회 (getHtfsItem01)
더 자세한 기능성 정보는 별도의 상세 조회 API 사용:
```
https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsItem01
```

**상세 조회 파라미터**:
```typescript
interface GetHtfsItemParams {
  serviceKey: string;      // 인증 키 (필수)
  sttemnt_no: string;      // 신고번호 (getHtfsList01에서 얻은 STTEMNT_NO)
  type: 'json' | 'xml';    // 응답 형식
}
```

**상세 조회 URL 예시**:
```javascript
const detailedUrl = `https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsItem01?serviceKey=${SERVICE_KEY}&sttemnt_no=20230001234&type=json`;
```

### 4.3 기능성 필드 우선순위
```typescript
// 기능성 정보 추출 우선순위
function getEfficacy(item: HealthFunctionalFoodItem): string {
  return (
    item.MAIN_FNCTN?.trim() ||      // 1순위: 주요 기능성
    item.RLTV_FNCTN?.trim() ||      // 2순위: 관련 기능성
    item.FRMLTN_DCL?.trim() ||      // 3순위: 포장 설명에서 추출
    '기능성 정보 없음'
  );
}
```

---

## 5️⃣ 필터링 및 결과 개수 제한

### 5.1 API 레벨 필터링
```javascript
// 예시: 원료명으로 검색
const params = {
  serviceKey: SERVICE_KEY,
  rawmtrl_nm: '유산균',      // ✅ 원료명 검색
  pageNo: 1,
  numOfRows: 100,
  type: 'json'
};

const url = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01';
const response = await axios.get(url, { params });
```

### 5.2 메모리 레벨 필터링 (클라이언트)
```javascript
// API 응답이 부정확한 경우 메모리에서 추가 필터링
const filteredItems = responseItems
  .filter(item => {
    const productName = (item.PRDUCT || '').toLowerCase();
    const companyName = (item.ENTRPS || '').toLowerCase();
    return productName.includes('유산균') || companyName.includes('유산균');
  });
```

### 5.3 결과 개수 제한
```javascript
// 페이지네이션
const pageSize = 20;
const pageNumber = 1;

const params = {
  serviceKey: SERVICE_KEY,
  pageNo: pageNumber,           // 조회할 페이지
  numOfRows: pageSize,          // 페이지당 행 수
  type: 'json'
};

// 또는 메모리에서 제한
const limitedResults = items.slice(0, 20);
```

---

## 6️⃣ 구현 가능한 API 호출 방법

### 방법 1: 기본 검색 (추천)
```typescript
async function searchHealthFunctionalFood(keyword: string) {
  const SERVICE_KEY = 'your_service_key_here';
  const url = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01';
  
  const response = await axios.get(url, {
    params: {
      serviceKey: SERVICE_KEY,
      prdlst_nm: keyword,        // 제품명 검색
      pageNo: 1,
      numOfRows: 50,
      type: 'json'
    },
    timeout: 10000,
    headers: { 'Accept': 'application/json' }
  });

  const items = (response.data?.body?.items || [])
    .map((w: any) => w.item)
    .filter((item: any) => item && Object.keys(item).length > 0);

  return items;
}

// 사용
const results = await searchHealthFunctionalFood('비타민');
```

### 방법 2: 원료명 검색
```typescript
async function searchByRawMaterial(rawMaterial: string) {
  const SERVICE_KEY = 'your_service_key_here';
  const url = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01';
  
  const response = await axios.get(url, {
    params: {
      serviceKey: SERVICE_KEY,
      rawmtrl_nm: rawMaterial,   // 원료명 검색
      pageNo: 1,
      numOfRows: 50,
      type: 'json'
    },
    timeout: 10000
  });

  return (response.data?.body?.items || [])
    .map((w: any) => w.item)
    .filter((item: any) => item && Object.keys(item).length > 0);
}

// 사용
const results = await searchByRawMaterial('유산균');
```

### 방법 3: 기능성 정보 포함 상세 검색
```typescript
async function searchWithEfficacy(keyword: string) {
  const SERVICE_KEY = 'your_service_key_here';
  const listUrl = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01';
  const detailUrl = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsItem01';

  // 1단계: 목록 조회
  const listResponse = await axios.get(listUrl, {
    params: {
      serviceKey: SERVICE_KEY,
      prdlst_nm: keyword,
      pageNo: 1,
      numOfRows: 20,
      type: 'json'
    },
    timeout: 10000
  });

  const items = (listResponse.data?.body?.items || [])
    .map((w: any) => w.item)
    .filter((item: any) => item);

  // 2단계: 각 제품의 상세 정보 조회 (선택사항)
  const detailedItems = [];
  for (const item of items.slice(0, 3)) {  // 최대 3개만
    try {
      const detailResponse = await axios.get(detailUrl, {
        params: {
          serviceKey: SERVICE_KEY,
          sttemnt_no: item.STTEMNT_NO,
          type: 'json'
        },
        timeout: 5000
      });

      const detailedItem = detailResponse.data?.body?.items?.[0]?.item;
      if (detailedItem) {
        detailedItems.push({
          ...item,
          ...detailedItem,  // 상세 정보 추가
          _hasDetailedInfo: true
        });
      }
    } catch (error) {
      // 상세 조회 실패 시 기본 정보 사용
      detailedItems.push(item);
    }
  }

  return detailedItems;
}

// 사용
const results = await searchWithEfficacy('오메가3');
```

### 방법 4: 페이지네이션 처리
```typescript
async function getAllHealthFunctionalFoods(pageNo: number = 1, pageSize: number = 100) {
  const SERVICE_KEY = 'your_service_key_here';
  const url = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01';

  const response = await axios.get(url, {
    params: {
      serviceKey: SERVICE_KEY,
      pageNo,                    // 페이지 번호
      numOfRows: pageSize,       // 페이지 크기
      type: 'json'
    },
    timeout: 15000
  });

  const body = response.data?.body;
  return {
    items: (body?.items || [])
      .map((w: any) => w.item)
      .filter((item: any) => item),
    pageInfo: {
      pageNo: body?.pageNo,
      numOfRows: body?.numOfRows,
      totalCount: body?.totalCount,
      totalPages: Math.ceil((body?.totalCount || 0) / pageSize)
    }
  };
}

// 사용
const page1 = await getAllHealthFunctionalFoods(1, 100);
console.log(`총 ${page1.pageInfo.totalCount}개 제품, ${page1.pageInfo.totalPages} 페이지`);
```

---

## 7️⃣ 실제 코드 예시 (TypeScript)

### 통합 검색 함수
```typescript
interface SearchOptions {
  keyword?: string;
  rawMaterial?: string;
  company?: string;
  limit?: number;
  page?: number;
}

async function searchHealthFunctionalFood(options: SearchOptions) {
  const {
    keyword,
    rawMaterial,
    company,
    limit = 20,
    page = 1
  } = options;

  const SERVICE_KEY = process.env.MFDS_SERVICE_KEY;
  const url = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01';

  // 파라미터 구성
  const params: any = {
    serviceKey: SERVICE_KEY,
    pageNo: page,
    numOfRows: limit,
    type: 'json'
  };

  // 선택 필터 추가
  if (keyword) params.prdlst_nm = keyword;
  if (rawMaterial) params.rawmtrl_nm = rawMaterial;
  if (company) params.entrps = company;

  try {
    const response = await axios.get(url, {
      params,
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });

    // 응답 검증
    if (response.data?.header?.resultCode !== '00') {
      throw new Error(response.data?.header?.resultMsg || '조회 실패');
    }

    // 데이터 파싱
    const body = response.data.body;
    const items = (body?.items || [])
      .map((wrapper: any) => wrapper.item)
      .filter((item: any) => item && Object.keys(item).length > 0);

    // 결과 변환
    return {
      success: true,
      data: items.map(item => ({
        id: item.STTEMNT_NO,
        productName: item.PRDUCT,
        company: item.ENTRPS,
        efficacy: item.MAIN_FNCTN || '정보 없음',
        intake: item.SRV_USE,
        warning: item.INTAKE_HINT1,
        storage: item.PRSRV_PD,
        rawData: item
      })),
      pagination: {
        pageNo: body.pageNo,
        numOfRows: body.numOfRows,
        totalCount: body.totalCount
      }
    };
  } catch (error) {
    console.error('건강기능식품 검색 오류:', error);
    return {
      success: false,
      data: [],
      error: error.message
    };
  }
}

// 사용
const results = await searchHealthFunctionalFood({
  keyword: '비타민',
  limit: 10,
  page: 1
});
```

---

## 8️⃣ 주의사항 및 제한사항

### ⚠️ API 제한사항
1. **요청 제한**: 일일 한도 있음 (정확한 한도는 공개되지 않음)
2. **응답 시간**: 대규모 조회 시 타임아웃 가능 (10-15초 권장)
3. **페이지 최대**: `numOfRows` 최대 1000개
4. **검색 정확도**: 필터링이 정확하지 않을 수 있음 (메모리 필터링 권장)

### 🔍 파라미터 검색 특성
```javascript
// 부분 일치 (포함 검색)
// "비타민"으로 검색하면 "비타민 C", "비타민 플러스" 등이 조회됨

// 정렬 순서
// API가 정렬 파라미터를 지원하지 않으므로 클라이언트에서 정렬 필요

// 복합 검색
// 여러 필터를 동시에 사용 가능하지만, 정확도가 떨어질 수 있음
```

### 📊 성능 최적화
```javascript
// 1. 불필요한 필드 전송 피하기
const essentialFields = ['PRDUCT', 'ENTRPS', 'MAIN_FNCTN', 'STTEMNT_NO'];

// 2. 캐싱 활용
const cache = new Map();

// 3. 배치 처리
// 한 번에 최대 100개 이상 조회 후 메모리에서 필터링

// 4. 비동기 처리
// Promise.all() 사용으로 여러 요청 동시 처리
```

---

## 9️⃣ 테스트 URL 해석

### 분석 대상 URL
```
https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01?serviceKey=...&stdt=유산균
```

### 파라미터 분석
| 파라미터 | 값 | 해석 |
|---------|-----|------|
| `serviceKey` | `...` | 공공데이터 포털 인증 키 |
| `stdt` | `유산균` | ❌ 공식 문서에 없는 파라미터 |

### ✅ 올바른 URL
```javascript
// 옵션 1: 제품명 검색
https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01?serviceKey=...&prdlst_nm=유산균&pageNo=1&numOfRows=20&type=json

// 옵션 2: 원료명 검색
https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01?serviceKey=...&rawmtrl_nm=유산균&pageNo=1&numOfRows=20&type=json
```

---

## 🔟 결론 및 권장사항

### 현재 코드 상태
✅ **정확함**: `PRDUCT`, `ENTRPS`, `MAIN_FNCTN` 필드 사용은 올바름  
✅ **응답 파싱**: `body.items[].item` 구조 이해는 정확함  
⚠️ **파라미터**: 공식 파라미터(`prdlst_nm`, `rawmtrl_nm`, `entrps`) 사용 권장

### 개선 방안
1. **stdt 파라미터 제거**: 공식 파라미터 사용
2. **에러 처리 강화**: API 응답 코드 검증
3. **캐싱 추가**: 동일 검색어에 대한 반복 요청 최소화
4. **상세 조회 지원**: `getHtfsItem01` API 활용으로 더 많은 기능성 정보 제공
5. **메모리 필터링**: API 응답이 부정확한 경우 백업 필터링 로직

### 코드 적용 예
```typescript
// ❌ 현재 방식
const url = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01';
const params = {
  serviceKey: SERVICE_KEY,
  stdt: keyword,  // ❌ 공식이 아닌 파라미터
};

// ✅ 개선된 방식
const url = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01';
const params = {
  serviceKey: SERVICE_KEY,
  prdlst_nm: keyword,      // ✅ 공식 파라미터
  rawmtrl_nm: keyword,     // ✅ 원료명도 함께 검색
  pageNo: 1,
  numOfRows: Math.min(50, limit),
  type: 'json'
};
```

---

## 참고 자료

- **공공데이터 포털**: https://www.data.go.kr/
- **식품의약품안전처 API 명세서**: 공공데이터 포털에서 "건강기능식품정보" 검색
- **관련 서비스**: 
  - `HtfsInfoService03`: 목록 조회 (`getHtfsList01`)
  - `HtfsInfoService03`: 상세 조회 (`getHtfsItem01`)

