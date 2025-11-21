# 공공데이터 API 문제 진단 및 해결 가이드

## 🔍 현재 발생 중인 오류

```
식품영양성분DB 조회 오류: Request failed with status code 404
응답 데이터: api not found

레시피DB 조회 오류: Request failed with status code 500
응답 데이터: unexpected errors
```

## 📋 테스트 방법

### 1. 백엔드 테스트 엔드포인트 사용

백엔드 서버가 실행 중일 때 브라우저에서 다음 URL을 열어보세요:

#### 전체 테스트
```
http://localhost:3001/api/opendata/test?foodName=삼겹살
```

#### 식품영양성분DB만 테스트
```
http://localhost:3001/api/opendata/test-nutrition?foodName=삼겹살
```

#### 레시피DB만 테스트
```
http://localhost:3001/api/opendata/test-recipe?foodName=삼겹살
```

#### API URL 디버깅 (실제 호출 URL 확인)
```
http://localhost:3001/api/opendata/debug?foodName=삼겹살
```

### 2. 브라우저에서 직접 테스트

`/api/opendata/debug` 엔드포인트에서 얻은 `fullUrl`을 복사하여 새 브라우저 탭에서 열어보세요.

## 🛠️ 예상 원인 및 해결 방법

### 원인 1: API 엔드포인트 경로 오류 (404 에러)

**문제:**
- `FoodNtrCpntDbInfo02` 서비스의 실제 엔드포인트가 다를 수 있음
- 공공데이터포털에서 제공하는 API 명세서와 불일치

**해결 방법:**

1. **공공데이터포털 확인**
   - https://www.data.go.kr/ 접속
   - "식품영양성분 데이터베이스" 검색
   - 실제 API 명세서 확인

2. **올바른 엔드포인트 사용**

   현재 사용 중:
   ```
   https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq
   ```

   가능한 대안:
   ```
   https://apis.data.go.kr/1471000/FoodNtrIrdntInfoService1/getFoodNtrItdntList1
   https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo/list
   https://apis.data.go.kr/1471000/FoodNtrCpntDbInq/getFoodNtrCpntDbInq
   ```

### 원인 2: 파라미터 이름 오류

**문제:**
- API가 요구하는 파라미터 이름과 현재 사용 중인 이름이 다름

**현재 사용 중인 파라미터:**
```typescript
DESC_KOR: foodName  // 식품영양성분DB
RECIPE_NM_KO: foodName  // 레시피DB
```

**가능한 대안:**
```typescript
// 식품영양성분DB
FOOD_NM_KR: foodName
FOOD_NAME: foodName
PRDLST_NM: foodName
DESC_KOR: foodName

// 레시피DB
RECIPE_NM: foodName
RCP_NM: foodName
```

### 원인 3: 서비스 키 인증 문제

**문제:**
- 서비스 키가 해당 API에 등록되지 않았을 수 있음
- 서비스 키 형식이 잘못되었을 수 있음

**해결 방법:**

1. **공공데이터포털에서 확인**
   - 마이페이지 → 오픈API → 개발계정 상세
   - 해당 API의 활용신청 승인 상태 확인
   - 서비스 키가 "일반 인증키(Encoding)"인지 "일반 인증키(Decoding)"인지 확인

2. **현재 코드 수정**
   ```typescript
   // decodeURIComponent 제거 테스트
   serviceKey: this.API_KEYS.foodNutrition  // decodeURIComponent 없이
   ```

### 원인 4: API 버전 또는 서비스 종료

**문제:**
- API 버전이 변경되었거나 서비스가 종료되었을 수 있음

**해결 방법:**

공공데이터포털에서 최신 API 확인:
- 식품의약품안전처_식품영양성분 DB 정보
- 농촌진흥청_농식품 조리법 정보

## 🔧 즉시 적용 가능한 수정 사항

### 수정 1: 식품영양성분DB API 변경

```typescript
// opendata.service.ts
private readonly BASE_URLS = {
  // 기존
  foodNutrition: 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq',
  
  // 대안 1 - 이전 버전
  foodNutrition: 'https://apis.data.go.kr/1471000/FoodNtrIrdntInfoService1/getFoodNtrItdntList1',
  
  // 대안 2 - 다른 서비스
  foodNutrition: 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInq/getFoodNtrCpntDbInqList',
};
```

### 수정 2: 레시피DB API 파라미터 변경

```typescript
// 현재
const response = await axios.get(url, {
  params: {
    serviceKey: decodeURIComponent(this.API_KEYS.recipeDB),
    RECIPE_NM_KO: foodName,
    type: 'json',
    numOfRows: 3,
    pageNo: 1,
  },
});

// 대안 1 - 파라미터명 변경
const response = await axios.get(url, {
  params: {
    serviceKey: decodeURIComponent(this.API_KEYS.recipeDB),
    RCP_NM: foodName,  // 변경
    type: 'json',
    numOfRows: 3,
    pageNo: 1,
  },
});

// 대안 2 - 인코딩 제거
const response = await axios.get(url, {
  params: {
    serviceKey: this.API_KEYS.recipeDB,  // decodeURIComponent 제거
    RECIPE_NM_KO: foodName,
    type: 'json',
    numOfRows: 3,
    pageNo: 1,
  },
});
```

### 수정 3: 검색 방식 변경 (키워드 대신 전체 조회 후 필터링)

```typescript
// 파라미터 없이 전체 조회
const response = await axios.get(url, {
  params: {
    serviceKey: this.API_KEYS.foodNutrition,
    type: 'json',
    numOfRows: 100,
    pageNo: 1,
  },
});

// 클라이언트에서 필터링
const filteredData = response.data.body.items.filter(item => 
  item.DESC_KOR?.includes(foodName) || item.FOOD_NM_KR?.includes(foodName)
);
```

## 📝 권장 테스트 순서

1. **디버그 엔드포인트로 실제 URL 확인**
   ```
   http://localhost:3001/api/opendata/debug?foodName=삼겹살
   ```

2. **브라우저에서 직접 테스트**
   - fullUrl 복사하여 새 탭에서 열기
   - 실제 응답 확인

3. **오류 메시지 분석**
   - 404: 엔드포인트 경로 오류
   - 500: 서버 오류 또는 파라미터 오류
   - 인증 오류: 서비스 키 문제

4. **공공데이터포털에서 API 명세서 다운로드**
   - 정확한 엔드포인트 확인
   - 파라미터 이름 확인
   - 응답 구조 확인

5. **코드 수정 후 재테스트**

## 🚀 임시 해결 방법 (API 실패 시)

공공데이터 API가 계속 실패할 경우, Gemini AI가 일반 지식으로 분석하도록 이미 구현되어 있습니다:

```typescript
// food.service.ts에서 이미 처리 중
if (error) {
  console.error('공공데이터 조회 실패, AI 일반 분석으로 진행');
  // AI가 일반 영양학 지식으로 분석
}
```

현재 페퍼로니 피자 분석이 정상적으로 작동하는 것은 이 fallback 로직 덕분입니다.

## 📞 추가 지원

테스트 결과를 공유해주시면 더 정확한 해결 방법을 제시할 수 있습니다:
1. `/api/opendata/debug` 응답
2. 브라우저에서 직접 테스트한 결과
3. 백엔드 콘솔의 상세 오류 로그
