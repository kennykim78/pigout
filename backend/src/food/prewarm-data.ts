/**
 * 인기 음식 사전 캐싱을 위한 데이터
 * 자주 검색되는 음식 + 주요 질병 조합
 * 월 1회 실행으로 충분한 커버리지 확보
 */

// 자주 검색되는 인기 음식 Top 100
export const POPULAR_FOODS = [
  // 한식 - 밥/죽
  '밥', '현미밥', '잡곡밥', '김밥', '비빔밥', '볶음밥', '김치볶음밥',
  '죽', '호박죽', '전복죽', '삼계죽',
  
  // 한식 - 찌개/탕/국
  '김치찌개', '된장찌개', '순두부찌개', '부대찌개', '청국장찌개',
  '삼계탕', '갈비탕', '설렁탕', '육개장', '감자탕', '곰탕', '추어탕',
  '미역국', '떡국', '만두국', '콩나물국',
  
  // 한식 - 고기
  '삼겹살', '불고기', '갈비', 'LA갈비', '제육볶음', '돼지갈비',
  '닭갈비', '찜닭', '치킨', '삼계탕', '닭볶음탕',
  '소고기', '한우', '육회',
  
  // 한식 - 면/분식
  '라면', '짜파게티', '냉면', '칼국수', '잔치국수', '비빔국수',
  '떡볶이', '순대', '튀김', '어묵', '김말이',
  '만두', '수제비',
  
  // 한식 - 반찬/기타
  '김치', '깍두기', '나물', '시금치나물', '콩나물',
  '두부', '계란', '계란찜', '계란말이',
  '전', '김치전', '파전', '해물파전',
  '족발', '보쌈', '곱창',
  
  // 중식
  '짜장면', '짬뽕', '탕수육', '볶음밥', '마라탕', '마라샹궈',
  '깐풍기', '유린기', '양장피', '팔보채',
  
  // 일식
  '초밥', '회', '사시미', '돈가스', '우동', '라멘', '소바',
  '덮밥', '카츠동', '규동', '오니기리',
  
  // 양식
  '피자', '햄버거', '파스타', '스파게티', '스테이크',
  '샐러드', '샌드위치', '리조또', '그라탕',
  '감자튀김', '너겟',
  
  // 간식/디저트/음료
  '빵', '케이크', '쿠키', '아이스크림', '과자', '초콜릿',
  '커피', '녹차', '콜라', '주스', '우유', '요거트',
  
  // 건강식/다이어트
  '닭가슴살', '고구마', '바나나', '사과', '오이', '토마토',
  '견과류', '아몬드', '브로콜리', '양배추',
];

// 주요 질병 (사용자가 많이 선택하는 질병) - 확장
export const COMMON_DISEASES = [
  '당뇨',
  '고혈압',
  '고지혈증',
  '신장질환',
  '통풍',
  '간질환',
  '심장질환',
  '위장질환',
  '갑상선질환',
  '비만',
];

// 흔한 복합 질병 조합
export const COMMON_DISEASE_COMBINATIONS = [
  ['당뇨', '고혈압'],
  ['당뇨', '고지혈증'],
  ['당뇨', '비만'],
  ['고혈압', '고지혈증'],
  ['고혈압', '심장질환'],
  ['고혈압', '비만'],
  ['고지혈증', '비만'],
  ['당뇨', '고혈압', '고지혈증'], // 대사증후군
  ['당뇨', '신장질환'],
  ['간질환', '고지혈증'],
];

// 사전 캐싱할 조합 생성
export function generatePrewarmCombinations(): Array<{
  foodName: string;
  diseases: string[];
}> {
  const combinations: Array<{ foodName: string; diseases: string[] }> = [];
  
  // 1. 모든 인기 음식 × 질병 없음 (100개)
  for (const food of POPULAR_FOODS) {
    combinations.push({ foodName: food, diseases: [] });
  }
  
  // 2. 상위 50개 음식 × 단일 질병 (50 × 10 = 500개)
  for (const food of POPULAR_FOODS.slice(0, 50)) {
    for (const disease of COMMON_DISEASES) {
      combinations.push({ foodName: food, diseases: [disease] });
    }
  }
  
  // 3. 상위 30개 음식 × 복합 질병 조합 (30 × 10 = 300개)
  for (const food of POPULAR_FOODS.slice(0, 30)) {
    for (const combo of COMMON_DISEASE_COMBINATIONS) {
      combinations.push({ foodName: food, diseases: combo });
    }
  }
  
  return combinations;
}

// 통계 출력
export function getPrewarmStats() {
  const combos = generatePrewarmCombinations();
  const foodOnly = combos.filter(c => c.diseases.length === 0).length;
  const singleDisease = combos.filter(c => c.diseases.length === 1).length;
  const multiDisease = combos.filter(c => c.diseases.length > 1).length;
  
  return {
    totalCombinations: combos.length,
    foodOnly,
    singleDisease,
    multiDisease,
    estimatedTime: `${Math.ceil(combos.length * 3 / 60)}분`, // 각 3초 가정
    estimatedCost: `약 $${(combos.length * 0.001).toFixed(2)}`, // 각 $0.001 가정
    breakdown: {
      foods: POPULAR_FOODS.length,
      diseases: COMMON_DISEASES.length,
      diseaseCombos: COMMON_DISEASE_COMBINATIONS.length,
    },
  };
}
