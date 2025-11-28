/**
 * 인기 음식 사전 캐싱을 위한 데이터
 * 자주 검색되는 음식 + 주요 질병 조합
 */

// 자주 검색되는 인기 음식 Top 50
export const POPULAR_FOODS = [
  // 한식
  '삼겹살', '김치찌개', '된장찌개', '불고기', '비빔밥',
  '제육볶음', '김치볶음밥', '라면', '짜파게티', '떡볶이',
  '순대', '냉면', '칼국수', '삼계탕', '갈비탕',
  '설렁탕', '육개장', '부대찌개', '순두부찌개', '감자탕',
  
  // 중식
  '짜장면', '짬뽕', '탕수육', '볶음밥', '마라탕',
  
  // 일식
  '초밥', '돈가스', '우동', '라멘', '회',
  
  // 양식
  '피자', '치킨', '햄버거', '파스타', '스테이크',
  '샐러드', '샌드위치',
  
  // 간식/디저트
  '빵', '케이크', '아이스크림', '과자', '초콜릿',
  '커피', '콜라', '주스',
  
  // 건강식
  '현미밥', '샐러드', '닭가슴살', '고구마', '바나나',
];

// 주요 질병 (사용자가 많이 선택하는 질병)
export const COMMON_DISEASES = [
  '당뇨',
  '고혈압',
  '고지혈증',
  '신장질환',
  '통풍',
  '간질환',
  '심장질환',
];

// 사전 캐싱할 조합 생성
export function generatePrewarmCombinations(): Array<{
  foodName: string;
  diseases: string[];
}> {
  const combinations: Array<{ foodName: string; diseases: string[] }> = [];
  
  // 1. 모든 인기 음식 × 질병 없음
  for (const food of POPULAR_FOODS) {
    combinations.push({ foodName: food, diseases: [] });
  }
  
  // 2. 인기 음식 × 단일 질병
  for (const food of POPULAR_FOODS.slice(0, 20)) { // 상위 20개 음식만
    for (const disease of COMMON_DISEASES) {
      combinations.push({ foodName: food, diseases: [disease] });
    }
  }
  
  // 3. 인기 음식 × 흔한 복합 질병 (당뇨+고혈압)
  for (const food of POPULAR_FOODS.slice(0, 10)) { // 상위 10개 음식만
    combinations.push({ foodName: food, diseases: ['당뇨', '고혈압'] });
    combinations.push({ foodName: food, diseases: ['당뇨', '고지혈증'] });
    combinations.push({ foodName: food, diseases: ['고혈압', '고지혈증'] });
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
  };
}
