# 🎯 AI 비용 절감 전략

## 현재 구현된 최적화

### 1. 분석 결과 캐싱 시스템 ✅

**테이블**: `analysis_cache`

```
캐시 키 = MD5(음식명 + 질병목록 + 약물목록)
```

**동작 방식**:
1. 사용자가 음식 분석 요청
2. 캐시 키 생성 (음식+질병+약물 조합)
3. 캐시 테이블에서 조회
   - **히트**: 기존 결과 즉시 반환 (AI 호출 없음!)
   - **미스**: AI 분석 수행 → 결과 캐시에 저장
4. 캐시 만료: 30일

**비용 절감 효과**:
- 동일 조합 재요청 시 **AI API 비용 0원**
- 공공데이터 API 호출도 생략
- 응답 속도 **5-10초 → 0.5초**로 개선

**통계 확인**: `GET /api/food/cache/stats`

---

### 2. 분석 모드 분리 ✅

| 모드 | 엔드포인트 | AI 모델 | API 호출 | 용도 |
|------|-----------|---------|----------|------|
| **Quick** | `/simple-text-analyze` | Flash | 최소 | Result01 (빠른 요약) |
| **Full** | `/text-analyze` | Pro | 전체 | Result2 (상세 분석) |

**비용 절감 효과**:
- 대부분 Quick 모드로 충분 → Pro 모델 호출 최소화
- Flash 모델: 약 $0.0001/요청
- Pro 모델: 약 $0.01/요청 (100배 비쌈)

---

### 3. 공공데이터 API 최적화 ✅

**기존**: 모든 API 호출 (5-6개)
```
e약은요 + 낱알식별 + 허가정보 + 영양성분 + 건강기능식품 + 레시피
```

**최적화 후**: 필수 API만 호출 (1-3개)
```
Quick: 없음 (순수 AI 지식)
Full: e약은요 + 영양성분 (필요시)
```

---

## 추가 최적화 제안

### 4. 인기 음식 사전 캐싱 (Proposed)

자주 검색되는 음식을 미리 분석해두기:

```sql
-- 인기 음식 Top 100 추출
SELECT food_name, COUNT(*) as search_count
FROM food_analysis
GROUP BY food_name
ORDER BY search_count DESC
LIMIT 100;
```

**구현 방법**:
- 크론 작업으로 매일 새벽 인기 음식 분석
- 주요 질병 조합 (당뇨, 고혈압 등)과 함께 사전 캐싱

---

### 5. 유사 음식 그룹화 (Proposed)

```
"불고기", "불고기정식", "불고기덮밥" → "불고기" 그룹
```

**장점**:
- 유사 음식도 캐시 재사용 가능
- AI에게 "대표 음식으로 변환" 요청

---

### 6. 토큰 사용량 모니터링 (Proposed)

```typescript
interface AIUsageLog {
  date: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}
```

일일/주간/월간 비용 리포트 생성

---

## 비용 추정

### 월간 1,000명 사용자 기준

| 시나리오 | AI 호출 | 예상 비용 |
|---------|--------|----------|
| **캐싱 없음** | 30,000회 | ~$300 |
| **캐싱 적용** | 5,000회 (83% 히트) | ~$50 |
| **최적화 완료** | 2,000회 (93% 히트) | ~$20 |

**연간 절감액**: ~$2,800

---

## Supabase에서 캐시 테이블 생성

```sql
-- backend/sql/add-analysis-cache.sql 파일 실행
```

1. Supabase 대시보드 → SQL Editor
2. `add-analysis-cache.sql` 내용 복사/붙여넣기
3. Run 클릭

---

## 캐시 관리

### 수동 캐시 정리

```sql
-- 만료된 캐시 삭제
SELECT cleanup_expired_cache();

-- 특정 음식 캐시 갱신
DELETE FROM analysis_cache WHERE food_name = '삼겹살';
```

### 캐시 통계 확인

```sql
SELECT * FROM cache_statistics;
```

| 지표 | 의미 |
|-----|------|
| total_entries | 캐시된 분석 결과 수 |
| total_hits | 총 캐시 히트 횟수 |
| avg_hits_per_entry | 항목당 평균 재사용 횟수 |
| estimated_savings | 추정 절감 비용 |
