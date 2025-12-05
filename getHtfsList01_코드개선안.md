# getHtfsList01 API 현재 코드 분석 및 개선안

## 📋 현재 코드 상태

### 현재 구현 위치
- **파일**: `backend/src/ai/utils/external-api.client.ts`
- **메서드**: `searchHealthFunctionalFoodByKeyword()`
- **호출**: `searchHealthFunctionalFood()` 메서드에서 호출

### 현재 코드 (라인 705-780)
```typescript
private async searchHealthFunctionalFoodByKeyword(keyword: string, numOfRows: number = 20): Promise<any[]> {
  try {
    const url = `${this.MFDS_BASE_URL}/HtfsInfoService03/getHtfsList01`;
    
    console.log(`[건강기능식품-검색] 키워드 검색 시작: ${keyword}`);
    
    const response = await axios.get(url, {
      params: {
        serviceKey: this.SERVICE_KEY,
        pageNo: 1,
        numOfRows: Math.max(numOfRows * 2, 100),
        type: 'json',
      },
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      },
    });

    const body = response.data?.body;
    if (!body) {
      console.log(`[건강기능식품-검색] 응답 body 없음`);
      return [];
    }
    
    // 검색 결과 파싱
    const items = body.items || [];
    let resultItems: any[] = [];
    
    if (Array.isArray(items)) {
      resultItems = items
        .map((wrapper: any) => wrapper.item)
        .filter((item: any) => item && Object.keys(item).length > 0);
    }
    
    if (!Array.isArray(resultItems) || resultItems.length === 0) {
      console.log(`[건강기능식품-검색] API 응답에서 아이템 없음`);
      return [];
    }
    
    console.log(`[건강기능식품-검색] API에서 ${resultItems.length}건 조회`);
    
    // 메모리 필터링
    const keywordLower = keyword.toLowerCase();
    const filteredItems = resultItems.filter((item: any) => {
      const productName = (item.PRDUCT || '').toLowerCase();
      const companyName = (item.ENTRPS || '').toLowerCase();
      return productName.includes(keywordLower) || companyName.includes(keywordLower);
    });
    
    console.log(`[건강기능식품-검색] 필터링 후: ${filteredItems.length}건`);
    
    const limitedResults = filteredItems.slice(0, numOfRows);
    return limitedResults.map((item: any) => this.convertHealthFoodToEasyDrugFormat(item, 'keyword'));
  } catch (error) {
    console.error('[건강기능식품-검색] API 호출 오류:', error.message);
    return [];
  }
}
```

---

## ✅ 현재 코드의 장점

1. **올바른 응답 구조 파싱**: `body.items[].item` 구조를 정확히 이해
2. **메모리 필터링**: API 필터링이 정확하지 않을 경우를 대비
3. **에러 처리**: try-catch로 기본 에러 처리
4. **필드 매핑**: `PRDUCT`, `ENTRPS`, `MAIN_FNCTN` 등 올바른 필드 사용
5. **로깅**: 디버깅을 위한 적절한 로그 출력

---

## ❌ 현재 코드의 문제점

### 1️⃣ **API 파라미터 누락** (중요)
```typescript
// ❌ 현재 상황: 필터링 파라미터 전송 안 함
const response = await axios.get(url, {
  params: {
    serviceKey: this.SERVICE_KEY,
    pageNo: 1,
    numOfRows: Math.max(numOfRows * 2, 100),
    type: 'json',
    // ❌ 파라미터 누락: prdlst_nm, rawmtrl_nm, entrps
  },
});

// ✅ 개선: API 파라미터 전송
const response = await axios.get(url, {
  params: {
    serviceKey: this.SERVICE_KEY,
    prdlst_nm: keyword,                           // ✅ 제품명 검색
    rawmtrl_nm: keyword,                          // ✅ 원료명 검색 (선택)
    pageNo: 1,
    numOfRows: Math.max(numOfRows * 2, 100),
    type: 'json',
  },
});
```

**영향**: 
- 현재는 전체 목록을 조회한 후 메모리에서 필터링
- API 서버에서 필터링할 경우 네트워크 트래픽 감소
- API 요청 결과 모수 감소 → 성능 향상

### 2️⃣ **응답 검증 부족**
```typescript
// ❌ 현재: header 검증 없음
const body = response.data?.body;
if (!body) {
  console.log(`응답 body 없음`);
  return [];
}

// ✅ 개선: header 검증 추가
if (response.data?.header?.resultCode !== '00') {
  console.error(`API 오류: ${response.data?.header?.resultMsg}`);
  return [];
}
const body = response.data?.body;
if (!body) {
  console.log(`응답 body 없음`);
  return [];
}
```

**영향**:
- API 오류를 명확히 파악 가능
- 예상치 못한 응답 처리 개선

### 3️⃣ **데이터 정확성 검증 부족**
```typescript
// ❌ 현재: item 존재 여부만 확인
if (!Array.isArray(resultItems) || resultItems.length === 0) {
  return [];
}

// ✅ 개선: 필수 필드 존재 여부 확인
const validItems = resultItems.filter((item: any) => {
  const hasProduct = item.PRDUCT || item.PRDLST_NM;
  const hasCompany = item.ENTRPS || item.BSSH_NM;
  return hasProduct && hasCompany;
});

if (validItems.length === 0) {
  console.log('유효한 상품 정보 없음');
  return [];
}
```

### 4️⃣ **검색 정확도 개선 필요**
```typescript
// ❌ 현재: 단순 포함 검색
const filteredItems = resultItems.filter((item: any) => {
  const productName = (item.PRDUCT || '').toLowerCase();
  const companyName = (item.ENTRPS || '').toLowerCase();
  return productName.includes(keywordLower) || companyName.includes(keywordLower);
});

// ✅ 개선: 더 정교한 검색
const filteredItems = resultItems.filter((item: any) => {
  const productName = (item.PRDUCT || '').toLowerCase();
  const rawMaterial = (item.RAW_MTRL || '').toLowerCase();
  const efficacy = (item.MAIN_FNCTN || '').toLowerCase();
  
  return (
    productName.includes(keywordLower) ||     // 제품명 검색
    rawMaterial.includes(keywordLower) ||     // 원료명 검색
    efficacy.includes(keywordLower)           // 기능성 검색
  );
});
```

### 5️⃣ **API 호출 최적화 부족**
```typescript
// ❌ 현재: 항상 고정 수량 조회
numOfRows: Math.max(numOfRows * 2, 100)  // 너무 많을 수 있음

// ✅ 개선: 동적 조정
const apiNumOfRows = Math.min(
  Math.max(numOfRows * 2, 50),    // 최소 50개
  1000                             // 최대 1000개 (API 제한)
);
```

### 6️⃣ **기능성 정보 추출 미흡**
```typescript
// 현재: convertHealthFoodToEasyDrugFormat에서 처리
// 하지만 상세 정보는 getHtfsItem01 API에서만 제공

// ✅ 개선: 선택적 상세 조회
private async getHealthFoodDetails(reportNo: string): Promise<any> {
  const url = `${this.MFDS_BASE_URL}/HtfsInfoService03/getHtfsItem01`;
  const response = await axios.get(url, {
    params: {
      serviceKey: this.SERVICE_KEY,
      sttemnt_no: reportNo,  // 신고번호
      type: 'json'
    },
    timeout: 5000
  });
  return response.data?.body?.items?.[0]?.item || null;
}
```

---

## 🔧 개선안 제시

### 개선 코드 (통합 버전)

```typescript
/**
 * 건강기능식품 키워드 검색 (개선 버전)
 * - API 파라미터 전송으로 서버 필터링 활용
 * - 응답 검증 강화
 * - 필드 검증 강화
 */
private async searchHealthFunctionalFoodByKeyword(
  keyword: string,
  numOfRows: number = 20,
  includeDetails: boolean = false  // 상세 정보 조회 여부
): Promise<any[]> {
  try {
    const url = `${this.MFDS_BASE_URL}/HtfsInfoService03/getHtfsList01`;
    
    console.log(`[건강기능식품-검색] 시작 - 키워드: ${keyword}, 개수: ${numOfRows}`);
    
    // 1️⃣ API 파라미터 설정 (서버 필터링)
    const apiNumOfRows = Math.min(
      Math.max(numOfRows * 2, 50),
      1000  // API 최대값
    );
    
    const params = {
      serviceKey: this.SERVICE_KEY,
      prdlst_nm: keyword,         // ✅ 제품명 검색 파라미터
      rawmtrl_nm: keyword,        // ✅ 원료명 검색 파라미터 (동시 적용)
      pageNo: 1,
      numOfRows: apiNumOfRows,
      type: 'json',
    };
    
    const response = await axios.get(url, {
      params,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      },
    });

    // 2️⃣ 응답 검증 (header 확인)
    if (response.data?.header?.resultCode !== '00') {
      console.warn(
        `[건강기능식품-검색] API 오류: ${response.data?.header?.resultMsg || '알 수 없음'}`
      );
      return [];
    }

    const body = response.data?.body;
    if (!body) {
      console.log(`[건강기능식품-검색] 응답 body 없음`);
      return [];
    }
    
    // 3️⃣ 데이터 파싱
    const items = body.items || [];
    let resultItems: any[] = [];
    
    if (Array.isArray(items)) {
      resultItems = items
        .map((wrapper: any) => wrapper.item)
        .filter((item: any) => {
          // 필수 필드 검증
          const hasProduct = item?.PRDUCT || item?.PRDLST_NM;
          const hasCompany = item?.ENTRPS || item?.BSSH_NM;
          return hasProduct && hasCompany && Object.keys(item).length > 0;
        });
    }
    
    if (resultItems.length === 0) {
      console.log(`[건강기능식품-검색] API 응답에서 유효한 아이템 없음`);
      return [];
    }
    
    console.log(`[건강기능식품-검색] API에서 ${resultItems.length}건 조회`);
    
    // 4️⃣ 메모리 필터링 (추가 정확도 향상)
    const keywordLower = keyword.toLowerCase();
    const filteredItems = resultItems.filter((item: any) => {
      const productName = (item.PRDUCT || item.PRDLST_NM || '').toLowerCase();
      const companyName = (item.ENTRPS || item.BSSH_NM || '').toLowerCase();
      const rawMaterial = (item.RAW_MTRL || '').toLowerCase();
      const efficacy = (item.MAIN_FNCTN || item.RLTV_FNCTN || '').toLowerCase();
      
      return (
        productName.includes(keywordLower) ||
        companyName.includes(keywordLower) ||
        rawMaterial.includes(keywordLower) ||
        efficacy.includes(keywordLower)
      );
    });
    
    console.log(`[건강기능식품-검색] 필터링 후: ${filteredItems.length}건`);
    
    // 5️⃣ 결과 개수 제한
    const limitedResults = filteredItems.slice(0, numOfRows);
    
    // 6️⃣ 형식 변환
    let finalResults = limitedResults.map((item: any) => 
      this.convertHealthFoodToEasyDrugFormat(item, 'keyword')
    );
    
    // 7️⃣ 선택적 상세 정보 조회
    if (includeDetails && finalResults.length > 0) {
      try {
        console.log(`[건강기능식품-검색] 상세 정보 조회 시작 (최대 3건)`);
        const detailedResults = [];
        
        for (let i = 0; i < Math.min(3, limitedResults.length); i++) {
          const reportNo = limitedResults[i].STTEMNT_NO || 
                          limitedResults[i].PRDLST_REPORT_NO;
          
          if (reportNo) {
            const details = await this.getHealthFoodDetails(reportNo);
            if (details) {
              detailedResults.push({
                ...finalResults[i],
                ...details,
                _hasDetailedInfo: true
              });
            } else {
              detailedResults.push(finalResults[i]);
            }
          } else {
            detailedResults.push(finalResults[i]);
          }
        }
        
        finalResults = detailedResults.concat(finalResults.slice(3));
      } catch (detailError) {
        console.warn(`[건강기능식품-검색] 상세 정보 조회 중 오류:`, detailError.message);
        // 상세 정보 오류는 무시하고 기본 정보만 반환
      }
    }
    
    console.log(`[건강기능식품-검색] ✅ 완료: ${finalResults.length}건 반환`);
    return finalResults;
    
  } catch (error) {
    console.error('[건강기능식품-검색] 예상치 못한 오류:', error.message);
    return [];
  }
}

/**
 * 건강기능식품 상세 정보 조회 (추가 메서드)
 */
private async getHealthFoodDetails(reportNo: string): Promise<any | null> {
  try {
    const url = `${this.MFDS_BASE_URL}/HtfsInfoService03/getHtfsItem01`;
    
    const response = await axios.get(url, {
      params: {
        serviceKey: this.SERVICE_KEY,
        sttemnt_no: reportNo,
        type: 'json',
      },
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.data?.header?.resultCode !== '00') {
      console.warn(`[건강기능식품-상세] 조회 실패: ${reportNo}`);
      return null;
    }

    return response.data?.body?.items?.[0]?.item || null;
  } catch (error) {
    console.warn(`[건강기능식품-상세] API 오류: ${error.message}`);
    return null;
  }
}
```

---

## 📊 개선 전후 비교

| 항목 | 현재 | 개선 후 |
|------|------|--------|
| API 파라미터 | ❌ 전송 안 함 | ✅ `prdlst_nm`, `rawmtrl_nm` 전송 |
| 응답 검증 | ⚠️ body만 확인 | ✅ header + body 검증 |
| 필드 검증 | ⚠️ 최소한 | ✅ 필수 필드 확인 |
| 검색 정확도 | ✅ 기본 | ✅✅ 강화 (원료명, 기능성 포함) |
| 상세 정보 | ❌ 없음 | ✅ 선택적 조회 |
| API 효율성 | ⚠️ 전체 조회 | ✅ 서버 필터링 |
| 에러 처리 | ⚠️ 기본 | ✅ 상세 |

---

## 🚀 적용 방법

### 1단계: 기존 메서드 이름 확인
```bash
grep -n "searchHealthFunctionalFoodByKeyword" backend/src/ai/utils/external-api.client.ts
```

### 2단계: 개선 코드 통합
기존 `searchHealthFunctionalFoodByKeyword` 메서드를 위의 개선 코드로 대체

### 3단계: 새 메서드 추가
`getHealthFoodDetails` 메서드를 새로 추가

### 4단계: 호출 코드 테스트
```typescript
// 기본 검색
const results = await client.searchHealthFunctionalFoodByKeyword('오메가3', 20);

// 상세 정보 포함 검색
const detailedResults = await client.searchHealthFunctionalFoodByKeyword(
  '오메가3', 
  20, 
  true  // includeDetails
);
```

---

## 📝 주의사항

1. **API 한도**: 상세 정보 조회는 추가 API 호출이므로 한도 확인
2. **타임아웃**: 상세 조회 시 전체 시간 증가 (10초 → 15초 이상)
3. **메모리**: 대량 조회 시 메모리 사용량 증가
4. **응답 포맷**: `getHtfsItem01` API 응답 구조가 다를 수 있음

---

## ✨ 결론

현재 코드는 **기본적으로 올바르게 구현**되어 있지만, 다음 개선으로 
효율성과 정확도를 크게 향상할 수 있습니다:

1. ✅ **API 파라미터 전송** - 네트워크 효율성 개선
2. ✅ **응답 검증 강화** - 안정성 개선
3. ✅ **검색 정확도 개선** - 사용자 만족도 개선
4. ✅ **상세 정보 조회** - 기능성 정보 제공 강화

