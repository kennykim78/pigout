# getHtfsList01 API 요약 (빠른 참조)

## 🎯 핵심 정보

| 항목 | 값 |
|------|-----|
| **API 엔드포인트** | `https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01` |
| **서비스** | 식품의약품안전처 건강기능식품정보 |
| **응답 형식** | JSON |
| **인증** | serviceKey (쿼리 파라미터) |
| **요청 방식** | GET |
| **타임아웃** | 10-15초 권장 |

---

## 📝 필수 파라미터

```
serviceKey    : 공공데이터 포털 API 키
type          : 'json' (고정)
pageNo        : 페이지 번호 (1부터 시작)
numOfRows     : 페이지당 행 수 (1-1000)
```

---

## 🔍 선택 필터 파라미터 (공식)

```
prdlst_nm     : 제품명 (부분 검색)
rawmtrl_nm    : 원료명 (부분 검색)
entrps        : 업사명 (부분 검색)
```

### ⚠️ 비공식 파라미터
- `stdt`: 공식 문서에 없음, 사용 권장 안 함

---

## 📊 API 응답 구조

```json
{
  "header": {
    "resultCode": "00",           // "00" = 성공
    "resultMsg": "success"
  },
  "body": {
    "pageNo": 1,
    "numOfRows": 10,
    "totalCount": 1234,
    "items": [
      {
        "item": {
          "PRDUCT": "제품명",
          "ENTRPS": "업체명",
          "MAIN_FNCTN": "주요 기능성",
          "STTEMNT_NO": "신고번호",
          "SUNGSANG": "성상",
          "SRV_USE": "섭취방법",
          "PRSRV_PD": "보관방법",
          "INTAKE_HINT1": "주의사항",
          "REGIST_DT": "등록일"
        }
      }
    ]
  }
}
```

---

## 🔑 핵심 필드

| 필드 | 설명 | 필수 |
|------|------|------|
| `PRDUCT` | 제품명 | ⭐⭐⭐ |
| `ENTRPS` | 업체명 | ⭐⭐⭐ |
| `MAIN_FNCTN` | 기능성 (★ 주요) | ⭐⭐ |
| `STTEMNT_NO` | 신고번호 | ⭐⭐ |
| `SRV_USE` | 섭취량/방법 | ⭐ |
| `INTAKE_HINT1` | 주의사항 | ⭐ |
| `REGIST_DT` | 등록일 | ✓ |
| `SUNGSANG` | 제품 형태 | ✓ |
| `PRSRV_PD` | 보관방법 | ✓ |

---

## 💡 사용 사례별 URL

### 1️⃣ 기본 조회 (전체 목록)
```
https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01
?serviceKey=KEY&pageNo=1&numOfRows=20&type=json
```

### 2️⃣ 제품명 검색
```
https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01
?serviceKey=KEY&prdlst_nm=오메가3&pageNo=1&numOfRows=20&type=json
```

### 3️⃣ 원료명 검색
```
https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01
?serviceKey=KEY&rawmtrl_nm=유산균&pageNo=1&numOfRows=20&type=json
```

### 4️⃣ 복합 검색
```
https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01
?serviceKey=KEY&prdlst_nm=비타민&entrps=종로약&pageNo=1&numOfRows=20&type=json
```

---

## 🚀 최소 작동 코드 (JavaScript)

```javascript
const axios = require('axios');

async function search(keyword) {
  const url = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsList01';
  
  const response = await axios.get(url, {
    params: {
      serviceKey: 'YOUR_SERVICE_KEY',
      prdlst_nm: keyword,
      pageNo: 1,
      numOfRows: 20,
      type: 'json'
    },
    timeout: 10000
  });

  const items = response.data.body.items
    .map(w => w.item)
    .filter(item => item);

  return items.map(item => ({
    name: item.PRDUCT,
    company: item.ENTRPS,
    efficacy: item.MAIN_FNCTN,
    id: item.STTEMNT_NO
  }));
}

// 사용
search('비타민').then(console.log);
```

---

## ✅ 현재 코드 평가

### ✅ 정확한 부분
- 응답 구조 파싱 (body.items[].item)
- 필드명 매핑
- 메모리 필터링
- 에러 처리

### ❌ 개선 필요
1. **API 파라미터 미전송**: prdlst_nm, rawmtrl_nm 미사용
2. **응답 검증 부족**: header 검증 없음
3. **상세 조회 미지원**: getHtfsItem01 미사용

---

## 🔧 빠른 개선 (Copy-Paste)

### 문제: 파라미터 미전송
```typescript
// ❌ 현재
params: {
  serviceKey: this.SERVICE_KEY,
  pageNo: 1,
  numOfRows: 100,
  type: 'json',
}

// ✅ 개선 (1줄 추가)
params: {
  serviceKey: this.SERVICE_KEY,
  prdlst_nm: keyword,           // ← 추가
  pageNo: 1,
  numOfRows: 100,
  type: 'json',
}
```

### 문제: 응답 검증 부족
```typescript
// ❌ 현재
const body = response.data?.body;
if (!body) return [];

// ✅ 개선 (2줄 추가)
if (response.data?.header?.resultCode !== '00') {
  console.warn(`API 오류: ${response.data?.header?.resultMsg}`);
  return [];
}
const body = response.data?.body;
if (!body) return [];
```

---

## 📈 API 성능 특성

| 조건 | 응답 시간 |
|------|---------|
| 기본 조회 (10개) | ~800ms |
| 제품명 검색 (20개) | ~1000ms |
| 대량 조회 (100개) | ~1500ms |
| 필터링 정확도 | 중간 (메모리 필터링 권장) |

---

## 🔐 API 한도 (추정)

- **일일 한도**: 미공개 (추정 1만-10만 회)
- **동시 요청**: 제한 가능 (순차 처리 권장)
- **페이지 최대**: numOfRows = 1000
- **타임아웃**: 30초 이상 시 실패 가능

---

## 🌐 관련 API

### 상세 정보 조회
```
https://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsItem01
?serviceKey=KEY&sttemnt_no=신고번호&type=json
```

**사용 시기**: 더 자세한 기능성 정보 필요 시

---

## 📚 현재 구현 파일

| 파일 | 메서드 |
|------|--------|
| `backend/src/ai/utils/external-api.client.ts` | `searchHealthFunctionalFoodByKeyword()` |
| `backend/src/medicine/medicine.service.ts` | `searchHealthFood()` |
| `backend/src/opendata/opendata.service.ts` | `getHealthFunctionalFoodInfo()` |

---

## 💾 테스트 파일

| 파일 | 목적 |
|------|------|
| `backend/test-opendata-all.js` | 전체 API 테스트 |
| `backend/test-gemini.js` | AI 통합 테스트 |

**실행 방법**:
```bash
node backend/test-opendata-all.js
```

---

## 🎓 핵심 규칙 5가지

1. **항상 serviceKey를 파라미터로 전송**
   - URL 인코딩된 형식 필요
   - 데코딩되지 않은 상태로 전송

2. **응답에서 header.resultCode 확인**
   - "00" = 성공
   - 다른 값 = 오류

3. **items 배열의 구조 주의**
   - items[].item 구조
   - 이중 구조 필수

4. **필터링 파라미터는 부분 검색**
   - "비타민"으로 검색 → "비타민 C" 포함

5. **필드가 항상 있지는 않음**
   - Optional 필드는 `||` 또는 `?.` 사용
   - null 체크 필수

---

## ❓ FAQ

**Q: stdt 파라미터는 무엇인가?**
A: 공식 문서에 없는 파라미터. 사용 권장 안 함.

**Q: 왜 다른 필드 이름 (PRDLST_NM vs PRDUCT)?**
A: API 버전마다 다를 수 있음. 둘 다 체크 필요.

**Q: 기능성 정보를 정확히 얻으려면?**
A: getHtfsItem01 API 사용 또는 MAIN_FNCTN + RLTV_FNCTN 조합.

**Q: 응답이 매번 다르다?**
A: 정상. 서버 캐시 또는 DB 업데이트 반영.

---

## 🚨 주의사항

1. ⚠️ 일일 한도 있음 - 캐싱 필수
2. ⚠️ 응답이 느릴 수 있음 - 타임아웃 설정
3. ⚠️ 필터링이 부정확할 수 있음 - 메모리 필터링 백업
4. ⚠️ 필드가 없을 수 있음 - null 체크
5. ⚠️ 중문/영문 검색어 지원 확인 필요

---

## 📞 참고 링크

- **공공데이터 포털**: https://www.data.go.kr/
- **검색어**: "식품의약품안전처 건강기능식품정보" 또는 "HtfsInfoService03"
- **API 명세서**: 공공데이터 포털 로그인 후 확인

