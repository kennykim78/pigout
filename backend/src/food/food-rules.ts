/**
 * 계층적 분석을 위한 규칙 기반 음식 데이터
 * 일반적인 음식은 AI 호출 없이 규칙으로 처리
 */

/**
 * 음식명 정규화: 유사 표현을 표준 음식명으로 변환
 * Result01에서만 사용 (캐시 히트율 향상)
 */
export function normalizeFoodName(foodName: string): string {
  const normalized = foodName.trim().toLowerCase();
  
  // 음식명 매핑 테이블
  const foodMap: Record<string, string> = {
    // 밥류
    '쌀밥': '밥',
    '백미': '밥',
    '백미밥': '밥',
    '흰쌀밥': '밥',
    '현미': '현미밥',
    
    // 과일
    '사과1개': '사과',
    '사과 1개': '사과',
    '바나나1개': '바나나',
    '바나나 1개': '바나나',
    
    // 단백질
    '달걀': '계란',
    '삶은계란': '계란',
    '계란1개': '계란',
    '닭고기': '닭가슴살',
    '닭가슴살100g': '닭가슴살',
    
    // 채소
    '브로콜리100g': '브로콜리',
    '시금치나물': '시금치',
    
    // 기타
    '물1컵': '물',
    '생수': '물',
  };
  
  return foodMap[normalized] || foodName;
}

type DiseaseRiskLevel = 'safe' | 'caution' | 'warning' | 'recommend';

interface DiseaseAnalysisEntry {
  scoreModifier: number;
  risk: DiseaseRiskLevel;
  reason: string;
}

interface NutrientInfo {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sodium: string;
  potassium: string;
  sugar: string;
}

interface RuleFoodData {
  score: number;
  summary: string;
  pros: string;
  cons: string;
  expertAdvice: string;
  nutrients?: NutrientInfo;
  diseaseAnalysis?: Record<string, DiseaseAnalysisEntry>;
}

// 안전한 일반 음식 (대부분의 질병에서 안전)
export const SAFE_FOODS: Record<string, RuleFoodData> = {
  '물': {
    score: 95,
    summary: '물은 인체의 60-70%를 구성하는 필수 성분으로, 모든 대사 과정에 필요합니다. 하루 2L 정도의 충분한 수분 섭취는 건강 유지에 필수적입니다.',
    pros: '수분 보충, 신진대사 촉진, 독소 배출, 피부 건강, 체온 조절',
    cons: '과도한 섭취 시 저나트륨혈증 가능, 신장질환자는 섭취량 조절 필요',
    expertAdvice: '하루 8잔(약 2L)을 식사 사이사이에 나눠 마시는 것이 좋습니다.',
    nutrients: {
      calories: '0kcal/100g',
      protein: '0g',
      carbs: '0g',
      fat: '0g',
      fiber: '0g',
      sodium: '0mg',
      potassium: '0mg',
      sugar: '0g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 5, risk: 'safe', reason: '혈당에 영향 없음, 대사 원활화' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '나트륨 배출에 도움' },
      '고지혈증': { scoreModifier: 5, risk: 'safe', reason: '혈액 순환 개선 및 노폐물 배출' },
      '신장질환': { scoreModifier: -15, risk: 'caution', reason: '신부전 단계에 따라 수분 제한 필요, 부종 악화 위험' },
      '심장질환': { scoreModifier: -5, risk: 'caution', reason: '심부전 환자의 경우 체액 과부하 주의' },
      '간질환': { scoreModifier: 0, risk: 'safe', reason: '복수 찬 경우를 제외하면 일반적 섭취 권장' },
      '통풍': { scoreModifier: 10, risk: 'recommend', reason: '소변을 통한 요산 배출 촉진' },
      '위장질환': { scoreModifier: 5, risk: 'safe', reason: '소화액 분비 및 변비 예방' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 0, risk: 'safe', reason: '직접적 영향 없음' },
    },
  },
  '밥': {
    score: 70,
    summary: '한국인의 주식인 백미밥은 에너지를 빠르게 공급하고 소화가 잘 됩니다. 하지만 도정 과정에서 영양소가 손실되어 섬유질이 부족하고 혈당을 빠르게 올립니다.',
    pros: '빠른 에너지 공급, 소화 용이, 저칼륨(신장질환 유리)',
    cons: '높은 당지수(GI), 낮은 영양 밀도, 비타민/미네랄 부족',
    expertAdvice: '당뇨 환자는 섭취를 줄이고, 잡곡을 섞어 드시는 것이 좋습니다.',
    nutrients: {
      calories: '130kcal/100g',
      protein: '2.7g',
      carbs: '28g',
      fat: '0.3g',
      fiber: '0.4g',
      sodium: '1mg',
      potassium: '29mg',
      sugar: '0.1g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: -20, risk: 'warning', reason: '높은 GI지수로 식후 혈당 급상승 유발' },
      '고혈압': { scoreModifier: 0, risk: 'safe', reason: '나트륨이 적어 직접적 해악 없음' },
      '고지혈증': { scoreModifier: -10, risk: 'caution', reason: '과잉 탄수화물은 중성지방 수치를 높임' },
      '신장질환': { scoreModifier: 5, risk: 'safe', reason: '칼륨과 인 함량이 낮아 신장 환자에게는 현미보다 안전' },
      '심장질환': { scoreModifier: -5, risk: 'caution', reason: '정제 탄수화물이 중성지방 증가 리스크' },
      '간질환': { scoreModifier: 0, risk: 'safe', reason: '에너지원으로 무난함' },
      '통풍': { scoreModifier: 0, risk: 'safe', reason: '퓨린 함량 낮음' },
      '위장질환': { scoreModifier: 10, risk: 'recommend', reason: '소화가 잘 되어 위염/장염 환자에게 적합' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
    },
  },
  '현미밥': {
    score: 85,
    summary: '현미는 쌀겨와 배아를 남겨둔 쌀로, 백미보다 비타민, 미네랄, 식이섬유가 풍부합니다. 혈당 조절과 다이어트에 효과적입니다.',
    pros: '풍부한 식이섬유, 낮은 당지수, 비타민 B군 함유, 포만감 유지',
    cons: '거친 식감, 소화 불량 가능성, 높은 칼륨/인 함량',
    expertAdvice: '충분히 불려서 짓고, 30번 이상 꼭꼭 씹어 드셔야 소화가 잘 됩니다.',
    nutrients: {
      calories: '110kcal/100g',
      protein: '3g',
      carbs: '23g',
      fat: '0.9g',
      fiber: '1.8g',
      sodium: '1mg',
      potassium: '90mg',
      sugar: '0.4g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 10, risk: 'recommend', reason: '식이섬유가 혈당 상승 속도를 늦춤' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '칼륨이 나트륨 배출을 도움' },
      '고지혈증': { scoreModifier: 5, risk: 'safe', reason: '식이섬유가 콜레스테롤 배출을 도움' },
      '신장질환': { scoreModifier: -25, risk: 'warning', reason: '높은 칼륨과 인 함량으로 신장에 부담' },
      '심장질환': { scoreModifier: 5, risk: 'safe', reason: '통곡물 섭취는 심혈관 건강에 도움' },
      '간질환': { scoreModifier: 0, risk: 'safe', reason: '양질의 에너지원' },
      '통풍': { scoreModifier: 0, risk: 'safe', reason: '퓨린 함량 낮음' },
      '위장질환': { scoreModifier: -10, risk: 'caution', reason: '식이섬유가 많아 소화가 잘 안 될 수 있음' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 0, risk: 'safe', reason: '피틴산이 철분 흡수를 일부 방해할 수 있음' },
    },
  },
  '사과': {
    score: 88,
    summary: '사과는 펙틴이라는 수용성 식이섬유가 풍부하여 장 건강에 좋고 항산화 물질이 많습니다. 아침 사과는 금이라는 말이 있을 정도로 건강에 유익합니다.',
    pros: '변비 예방, 피로 회복, 항산화 작용, 폐 기능 강화',
    cons: '위산 분비 촉진, 밤늦게 섭취 시 속쓰림, 과당 함유',
    expertAdvice: '껍질째 먹는 것이 펙틴과 안토시아닌 섭취에 가장 좋습니다.',
    nutrients: {
      calories: '57kcal/100g',
      protein: '0.3g',
      carbs: '14g',
      fat: '0.2g',
      fiber: '2.4g',
      sodium: '1mg',
      potassium: '107mg',
      sugar: '10g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 0, risk: 'safe', reason: 'GI지수가 낮지만 과당이 있어 적정량 섭취 필요' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '칼륨이 혈압 조절에 기여' },
      '고지혈증': { scoreModifier: 5, risk: 'safe', reason: '펙틴이 콜레스테롤 배출을 도움' },
      '신장질환': { scoreModifier: -10, risk: 'caution', reason: '칼륨 함량이 있어 섭취량 조절 필요' },
      '심장질환': { scoreModifier: 5, risk: 'safe', reason: '플라보노이드 성분이 심장병 위험 감소' },
      '간질환': { scoreModifier: 0, risk: 'safe', reason: '비타민C가 간 해독 도움' },
      '통풍': { scoreModifier: 5, risk: 'recommend', reason: '알칼리성 식품으로 요산 배출 도움' },
      '위장질환': { scoreModifier: -10, risk: 'caution', reason: '산 성분이 위염, 역류성 식도염 자극 가능' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 5, risk: 'safe', reason: '비타민C가 철분 흡수를 도움' },
    },
  },
  '바나나': {
    score: 80,
    summary: '바나나는 휴대하기 간편하고 소화가 잘 되는 에너지원입니다. 칼륨이 매우 풍부하여 나트륨 배출에 탁월하지만 당도가 높습니다.',
    pros: '즉각적인 에너지, 나트륨 배출, 우울증 완화(트립토판), 위 점막 보호',
    cons: '높은 당분, 신장 환자에게 위험한 수준의 고칼륨',
    expertAdvice: '잘 익은 바나나는 면역력을 높이지만, 당뇨 환자는 덜 익은 바나나가 낫습니다.',
    nutrients: {
      calories: '89kcal/100g',
      protein: '1.1g',
      carbs: '23g',
      fat: '0.3g',
      fiber: '2.6g',
      sodium: '1mg',
      potassium: '358mg',
      sugar: '12g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: -10, risk: 'caution', reason: '잘 익을수록 당 흡수가 빨라 혈당 주의' },
      '고혈압': { scoreModifier: 10, risk: 'recommend', reason: '풍부한 칼륨이 나트륨 배출을 강력히 도움' },
      '고지혈증': { scoreModifier: 0, risk: 'safe', reason: '지방 함량이 거의 없음' },
      '신장질환': { scoreModifier: -30, risk: 'warning', reason: '매우 높은 칼륨 함량으로 고칼륨혈증 위험' },
      '심장질환': { scoreModifier: 5, risk: 'safe', reason: '칼륨과 마그네슘이 심장 기능 보조' },
      '간질환': { scoreModifier: 0, risk: 'safe', reason: '소화가 잘 되어 간 부담 적음' },
      '통풍': { scoreModifier: 5, risk: 'safe', reason: '요산 결정 용해를 돕는 성분 함유' },
      '위장질환': { scoreModifier: 10, risk: 'recommend', reason: '부드럽고 펙틴이 장 안정을 도움' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 0, risk: 'safe', reason: '철분이 소량 있으나 큰 영향 없음' },
    },
  },
  '두부': {
    score: 92,
    summary: '밭에서 나는 소고기라 불리는 두부는 식물성 단백질의 최고 급원입니다. 소화 흡수율이 높고 리놀산이 풍부하여 콜레스테롤 수치를 낮추는 데 도움을 줍니다.',
    pros: '우수한 식물성 단백질, 낮은 포화지방, 소화 흡수율 95%, 이소플라본(항암/갱년기)',
    cons: '통풍 환자 과다 섭취 주의(퓨린), 갑상선 기능 저하 시 주의',
    expertAdvice: '동물성 지방 섭취를 줄여야 하는 만성질환자에게 최고의 단백질 대체제입니다.',
    nutrients: {
      calories: '84kcal/100g',
      protein: '8.5g',
      carbs: '1.9g',
      fat: '4.6g',
      fiber: '0.3g',
      sodium: '7mg',
      potassium: '121mg',
      sugar: '0.5g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 10, risk: 'recommend', reason: '혈당을 거의 올리지 않는 훌륭한 단백질원' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '나트륨 배출 및 혈관 건강 개선' },
      '고지혈증': { scoreModifier: 10, risk: 'recommend', reason: '리놀산과 레시틴이 콜레스테롤 저하 도움' },
      '신장질환': { scoreModifier: -5, risk: 'caution', reason: '식물성이지만 단백질 대사 산물 부담 가능, 칼륨 수치 고려 필요' },
      '심장질환': { scoreModifier: 10, risk: 'recommend', reason: '식물성 단백질 섭취는 심혈관 질환 위험 감소' },
      '간질환': { scoreModifier: 10, risk: 'recommend', reason: '간세포 재생을 돕는 양질의 단백질' },
      '통풍': { scoreModifier: -5, risk: 'caution', reason: '퓨린 함량이 육류보단 낮으나 과다 섭취 시 주의 필요' },
      '위장질환': { scoreModifier: 10, risk: 'recommend', reason: '부드럽고 소화가 매우 잘 됨' },
      '갑상선질환': { scoreModifier: -5, risk: 'caution', reason: '고이트로젠 성분이 요오드 흡수 방해 가능(조리 시 감소)' },
      '빈혈': { scoreModifier: 0, risk: 'safe', reason: '철분이 포함되어 있으나 흡수율은 육류보다 낮음' },
    },
  },
  '계란': {
    score: 90,
    summary: '완전식품이라 불리는 계란은 필수 아미노산이 균형 있게 들어있습니다. 노른자의 레시틴은 뇌 건강에 좋지만, 콜레스테롤 함량 때문에 섭취량 조절이 논의됩니다.',
    pros: '완전 단백질, 비타민 D, 레시틴(뇌 건강), 루테인(눈 건강), 저렴한 가격',
    cons: '노른자의 높은 콜레스테롤, 알레르기 유발 가능성',
    expertAdvice: '건강한 성인은 하루 1-2개도 무방하나, 고지혈증 환자는 노른자 섭취를 주 2-3회로 조절하세요.',
    nutrients: {
      calories: '155kcal/100g',
      protein: '13g',
      carbs: '1.1g',
      fat: '11g',
      fiber: '0g',
      sodium: '124mg',
      potassium: '126mg',
      sugar: '1.1g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 5, risk: 'recommend', reason: '탄수화물이 거의 없고 단백질 공급에 유리' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '흰자의 펩타이드 성분이 혈압 조절 도움' },
      '고지혈증': { scoreModifier: -5, risk: 'caution', reason: '노른자의 식이 콜레스테롤 함량이 높음' },
      '신장질환': { scoreModifier: 5, risk: 'safe', reason: '생물가가 높은 단백질로 노폐물 생성이 적음' },
      '심장질환': { scoreModifier: -5, risk: 'caution', reason: '당뇨 동반 시 콜레스테롤 섭취 주의 필요' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: '메티오닌이 간 해독 작용을 도움' },
      '통풍': { scoreModifier: 10, risk: 'recommend', reason: '퓨린 함량이 매우 낮아 안전한 단백질원' },
      '위장질환': { scoreModifier: 5, risk: 'safe', reason: '반숙 등 부드럽게 조리 시 소화 용이' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '셀레늄이 갑상선 건강 도움' },
      '빈혈': { scoreModifier: 5, risk: 'safe', reason: '노른자에 철분 함유' },
    },
  },
  '닭가슴살': {
    score: 88,
    summary: '저지방 고단백 식품의 대명사입니다. 필수 아미노산이 풍부하여 근육 생성과 유지에 탁월하며, 피로 회복 물질인 이미다졸 디펩타이드를 함유하고 있습니다.',
    pros: '강력한 단백질 공급, 낮은 지방, 근육 생성, 나이아신 풍부',
    cons: '퍽퍽한 식감, 식이섬유 및 비타민 부족, 조리법에 따라 나트륨 과다',
    expertAdvice: '채소와 함께 드셔야 부족한 식이섬유와 비타민을 보완할 수 있습니다.',
    nutrients: {
      calories: '109kcal/100g',
      protein: '23g',
      carbs: '0g',
      fat: '1.2g',
      fiber: '0g',
      sodium: '74mg',
      potassium: '256mg',
      sugar: '0g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 10, risk: 'recommend', reason: '인슐린 저항성 개선 및 근육량 유지에 필수' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '저지방 단백질은 혈압 관리에 도움' },
      '고지혈증': { scoreModifier: 10, risk: 'recommend', reason: '포화지방이 적어 육류 중 가장 권장됨' },
      '신장질환': { scoreModifier: -10, risk: 'caution', reason: '과다 단백질 섭취는 신장 과부하 (양 조절 필수)' },
      '심장질환': { scoreModifier: 10, risk: 'recommend', reason: '호모시스테인 억제 및 혈관 건강 유지' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: 'BCAA가 간 기능 보호' },
      '통풍': { scoreModifier: -5, risk: 'caution', reason: '퓨린 함량이 중간 수준, 발작 시 제한 필요' },
      '위장질환': { scoreModifier: 0, risk: 'safe', reason: '기름기 적어 소화 부담 적음' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 0, risk: 'safe', reason: '철분 흡수를 돕는 동물성 단백질' },
    },
  },
  '브로콜리': {
    score: 93,
    summary: '브로콜리는 글루코시놀레이트와 비타민 C, K가 풍부한 십자화과 채소로 항산화 및 항암 성분이 다양합니다.',
    pros: '강력한 항산화, 풍부한 식이섬유, 면역력 증진, 엽산과 비타민K 공급',
    cons: '가스 발생, 갑상선 기능 저하증 환자 과량 섭취 주의, 칼륨과 인이 높음',
    expertAdvice: '살짝 데쳐서 섭취하면 영양 손실을 줄이고 소화를 돕습니다.',
    nutrients: {
      calories: '34kcal/100g',
      protein: '2.8g',
      carbs: '6.6g',
      fat: '0.4g',
      fiber: '2.6g',
      sodium: '33mg',
      potassium: '316mg',
      sugar: '1.7g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 5, risk: 'recommend', reason: '식이섬유가 풍부해 혈당 상승을 늦춤' },
      '고혈압': { scoreModifier: 10, risk: 'recommend', reason: '칼륨과 항산화 성분이 혈압 조절을 도움' },
      '고지혈증': { scoreModifier: 10, risk: 'recommend', reason: '식이섬유와 술포라판이 LDL 저하에 기여' },
      '신장질환': { scoreModifier: -20, risk: 'warning', reason: '칼륨과 인이 높아 투석 환자 주의' },
      '심장질환': { scoreModifier: 10, risk: 'recommend', reason: '항산화 성분이 혈관 염증을 줄임' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: '해독 효소 활성화에 도움' },
      '통풍': { scoreModifier: 5, risk: 'safe', reason: '퓨린 함량이 낮은 채소' },
      '위장질환': { scoreModifier: 0, risk: 'safe', reason: '가열 시 소화가 무난하지만 생식 시 가스 유발 가능' },
      '갑상선질환': { scoreModifier: -5, risk: 'caution', reason: '고이트로젠이 요오드 흡수를 방해할 수 있음' },
      '빈혈': { scoreModifier: 5, risk: 'safe', reason: '엽산과 비타민 C가 철분 흡수를 도움' },
    },
  },
  '시금치': {
    score: 91,
    summary: '시금치는 철분, 엽산, 비타민 K가 풍부한 녹색 채소로 항산화 물질이 많습니다.',
    pros: '철분과 엽산 제공, 강력한 항산화, 루테인으로 눈 건강 지원',
    cons: '옥살산이 칼슘 흡수를 저해, 신장 결석 위험군 주의, 칼륨 과다',
    expertAdvice: '데치고 찬물에 헹궈 옥살산을 줄이면 위 부담과 결석 위험을 낮출 수 있습니다.',
    nutrients: {
      calories: '23kcal/100g',
      protein: '2.9g',
      carbs: '3.6g',
      fat: '0.4g',
      fiber: '2.2g',
      sodium: '79mg',
      potassium: '558mg',
      sugar: '0.4g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 5, risk: 'recommend', reason: '낮은 GI와 풍부한 마그네슘이 혈당 조절에 도움' },
      '고혈압': { scoreModifier: 10, risk: 'recommend', reason: '칼륨, 질산염이 혈관 이완을 촉진' },
      '고지혈증': { scoreModifier: 5, risk: 'safe', reason: '식이섬유와 항산화가 지질 개선에 도움' },
      '신장질환': { scoreModifier: -25, risk: 'warning', reason: '칼륨과 옥살산이 많아 투석 환자 제한' },
      '심장질환': { scoreModifier: 5, risk: 'safe', reason: '엽록소와 항산화가 혈관 건강 지원' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: '엽산이 간 기능 회복을 돕는다' },
      '통풍': { scoreModifier: -5, risk: 'caution', reason: '중간 수준의 퓨린과 옥살산이 요산 결정을 악화시킬 수 있음' },
      '위장질환': { scoreModifier: -5, risk: 'caution', reason: '생으로 많이 먹으면 속쓰림이나 가스 유발' },
      '갑상선질환': { scoreModifier: -10, risk: 'caution', reason: '고이트로젠이 갑상선 호르몬 합성 저해' },
      '빈혈': { scoreModifier: 0, risk: 'safe', reason: '철분 함유하지만 옥살산이 흡수를 일부 방해' },
    },
  },
  '양배추': {
    score: 87,
    summary: '양배추는 비타민 C와 U가 풍부하여 위 점막 보호와 항산화에 도움을 주는 채소입니다.',
    pros: '위점막 보호, 식이섬유 풍부, 비타민C 공급, 해독 성분 함유',
    cons: '가스 발생, 갑상선 기능 저하증 환자 과량 섭취 주의',
    expertAdvice: '생으로 먹을 땐 잘 씹고, 즙이나 살짝 데친 형태로 섭취하면 위장 보호 효과가 큽니다.',
    nutrients: {
      calories: '25kcal/100g',
      protein: '1.3g',
      carbs: '5.8g',
      fat: '0.1g',
      fiber: '2.5g',
      sodium: '18mg',
      potassium: '170mg',
      sugar: '3.2g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 5, risk: 'recommend', reason: '식이섬유와 낮은 GI로 혈당 변동을 줄임' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '칼륨이 나트륨 배출을 돕지만 함량이 과도하진 않음' },
      '고지혈증': { scoreModifier: 5, risk: 'safe', reason: '식이섬유가 콜레스테롤 배출을 지원' },
      '신장질환': { scoreModifier: 0, risk: 'safe', reason: '칼륨이 비교적 낮아 조절된 섭취 가능' },
      '심장질환': { scoreModifier: 5, risk: 'safe', reason: '항산화 성분이 혈관 염증을 완화' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: '해독 효소 유도 성분이 간 기능을 돕는다' },
      '통풍': { scoreModifier: 5, risk: 'safe', reason: '퓨린 함량이 매우 낮음' },
      '위장질환': { scoreModifier: 10, risk: 'recommend', reason: '비타민U가 위궤양 회복을 돕는다' },
      '갑상선질환': { scoreModifier: -10, risk: 'caution', reason: '생으로 과다 섭취 시 갑상선 기능 저하 가능' },
      '빈혈': { scoreModifier: 5, risk: 'safe', reason: '비타민C가 철분 흡수를 돕는다' },
    },
  },
  '당근': {
    score: 85,
    summary: '당근은 베타카로틴과 비타민 A 전구체가 풍부하여 시력과 면역 강화에 도움이 됩니다.',
    pros: '시력 보호, 항산화, 식이섬유, 칼륨 공급',
    cons: '과다 섭취 시 카로틴혈증, 가열 시 혈당지수 상승',
    expertAdvice: '기름에 살짝 볶거나 견과류와 함께 먹으면 지용성 비타민 흡수가 높아집니다.',
    nutrients: {
      calories: '41kcal/100g',
      protein: '0.9g',
      carbs: '10g',
      fat: '0.2g',
      fiber: '2.8g',
      sodium: '69mg',
      potassium: '320mg',
      sugar: '4.7g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 0, risk: 'safe', reason: '생으로 섭취 시 GI가 낮지만 과도한 주스 형태는 혈당 상승' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '칼륨과 항산화가 혈압 조절에 도움' },
      '고지혈증': { scoreModifier: 5, risk: 'safe', reason: '식이섬유가 LDL 감소를 돕는다' },
      '신장질환': { scoreModifier: -5, risk: 'caution', reason: '칼륨이 있어 제한식 시 양 조절 필요' },
      '심장질환': { scoreModifier: 5, risk: 'safe', reason: '카로티노이드가 혈관 산화 스트레스를 낮춤' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: '비타민 A 전구체가 간 기능 회복에 기여' },
      '통풍': { scoreModifier: 5, risk: 'safe', reason: '퓨린이 거의 없어 안전' },
      '위장질환': { scoreModifier: 5, risk: 'safe', reason: '섬유소가 장운동을 돕지만 생당근은 잘 씹어야 함' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 5, risk: 'safe', reason: '비타민C와 카로틴이 철분 이용을 보조' },
    },
  },
  '토마토': {
    score: 90,
    summary: '토마토는 라이코펜과 비타민 C가 풍부해 항산화 효과와 심혈관 보호에 도움이 됩니다.',
    pros: '라이코펜 항산화, 낮은 칼로리, 체액 균형 유지, 피부 보호',
    cons: '위산 과다 시 속쓰림, 신장질환자의 칼륨 관리 필요',
    expertAdvice: '익혀서 올리브유와 섭취하면 라이코펜 흡수가 크게 증가합니다.',
    nutrients: {
      calories: '18kcal/100g',
      protein: '0.9g',
      carbs: '3.9g',
      fat: '0.2g',
      fiber: '1.2g',
      sodium: '5mg',
      potassium: '237mg',
      sugar: '2.6g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 5, risk: 'recommend', reason: '낮은 GI와 항산화로 혈당 스트레스 완화' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '칼륨이 나트륨 배출을 돕는다' },
      '고지혈증': { scoreModifier: 5, risk: 'safe', reason: '라이코펜이 LDL 산화를 억제' },
      '신장질환': { scoreModifier: -10, risk: 'caution', reason: '칼륨과 옥살산이 있어 제한식 필요' },
      '심장질환': { scoreModifier: 10, risk: 'recommend', reason: '라이코펜이 심혈관 사건 위험 감소' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: '항산화가 간 염증을 줄임' },
      '통풍': { scoreModifier: 0, risk: 'safe', reason: '퓨린이 적지만 산성이 약간 요산 배출을 자극' },
      '위장질환': { scoreModifier: -5, risk: 'caution', reason: '산도가 높아 위염·역류 환자에게 자극' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 5, risk: 'safe', reason: '비타민C가 식물성 철분 흡수를 돕는다' },
    },
  },
  '오이': {
    score: 78,
    summary: '오이는 수분 함량이 95% 이상인 저칼로리 채소로 수분 보충과 해독에 도움을 줍니다.',
    pros: '풍부한 수분, 저칼로리, 칼륨과 비타민K 공급, 섬유질',
    cons: '영양 밀도가 낮음, 속이 찬 사람은 과량 섭취 시 복부 냉증',
    expertAdvice: '껍질에 영양소가 많으니 깨끗이 씻어 껍질째 먹되, 소화가 약하면 씨를 제거하세요.',
    nutrients: {
      calories: '15kcal/100g',
      protein: '0.7g',
      carbs: '3.6g',
      fat: '0.1g',
      fiber: '0.5g',
      sodium: '2mg',
      potassium: '147mg',
      sugar: '1.7g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 5, risk: 'recommend', reason: '극저칼로리로 혈당 변동이 거의 없음' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '칼륨과 수분이 나트륨 배출을 촉진' },
      '고지혈증': { scoreModifier: 0, risk: 'safe', reason: '직접적 영향은 없으나 저열량 간식 대체 가능' },
      '신장질환': { scoreModifier: -5, risk: 'caution', reason: '수분 제한 중이거나 칼륨 관리가 필요한 경우 조절' },
      '심장질환': { scoreModifier: 5, risk: 'safe', reason: '체액 균형과 혈압 관리에 도움' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: '수분과 항산화가 간 해독을 보조' },
      '통풍': { scoreModifier: 5, risk: 'safe', reason: '요산 배출을 돕는 수분 공급' },
      '위장질환': { scoreModifier: 5, risk: 'safe', reason: '수분과 섬유가 변비 완화에 도움' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 0, risk: 'safe', reason: '직접적 영향은 없으나 수분 공급에 유리' },
    },
  },
  '고구마': {
    score: 75,
    summary: '고구마는 식이섬유와 베타카로틴, 칼륨이 풍부한 복합 탄수화물 식품입니다.',
    pros: '풍부한 식이섬유, 베타카로틴, 포만감 유지, 장운동 촉진',
    cons: '혈당지수가 조리법에 따라 높음, 가스와 속쓰림 유발 가능, 칼륨 과다',
    expertAdvice: '껍질째 찌거나 구워 먹되 당뇨 환자는 식사량을 조절하고 단백질과 함께 드세요.',
    nutrients: {
      calories: '86kcal/100g',
      protein: '1.6g',
      carbs: '20g',
      fat: '0.1g',
      fiber: '3g',
      sodium: '55mg',
      potassium: '337mg',
      sugar: '4.2g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: -15, risk: 'warning', reason: '찐·군 고구마는 GI가 높아 혈당 급상승' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '칼륨이 혈압 조절을 돕는다' },
      '고지혈증': { scoreModifier: 0, risk: 'safe', reason: '지방이 적지만 과잉 탄수화물은 중성지방 상승' },
      '신장질환': { scoreModifier: -10, risk: 'caution', reason: '칼륨이 높아 제한 필요' },
      '심장질환': { scoreModifier: 5, risk: 'safe', reason: '베타카로틴이 항산화 역할' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: '비타민C와 식이섬유가 간 해독을 보조' },
      '통풍': { scoreModifier: 5, risk: 'safe', reason: '퓨린이 거의 없음' },
      '위장질환': { scoreModifier: 5, risk: 'safe', reason: '식이섬유가 변비를 완화하지만 과식 시 가스' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 5, risk: 'safe', reason: '철분과 구리가 헤모글로빈 합성을 지원' },
    },
  },
  '감자': {
    score: 72,
    summary: '감자는 전분이 풍부한 뿌리채소로 비타민 C와 칼륨을 공급하는 기본 탄수화물 식품입니다.',
    pros: '빠른 에너지 공급, 비타민C, 칼륨 풍부, 포만감',
    cons: '혈당지수가 높음, 튀김 조리 시 포화지방 증가, 칼륨 과다 가능',
    expertAdvice: '껍질째 찌거나 구워 먹으면 영양 손실이 적고 혈당 상승을 완화할 수 있습니다.',
    nutrients: {
      calories: '77kcal/100g',
      protein: '2g',
      carbs: '17g',
      fat: '0.1g',
      fiber: '2.2g',
      sodium: '6mg',
      potassium: '425mg',
      sugar: '0.8g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: -15, risk: 'warning', reason: '전분과 높은 GI로 혈당 급등' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '칼륨이 체액 균형을 돕지만 가공 시 나트륨 주의' },
      '고지혈증': { scoreModifier: -5, risk: 'caution', reason: '튀김, 버터 조리 시 포화지방 섭취 증가' },
      '신장질환': { scoreModifier: -15, risk: 'warning', reason: '칼륨이 많아 투석 환자 제한 필요' },
      '심장질환': { scoreModifier: 5, risk: 'safe', reason: '칼륨과 비타민C가 혈관 건강을 지원' },
      '간질환': { scoreModifier: 0, risk: 'safe', reason: '탄수화물 공급원으로 무난하나 과식 시 지방간 위험' },
      '통풍': { scoreModifier: 0, risk: 'safe', reason: '퓨린 함량이 낮음' },
      '위장질환': { scoreModifier: -5, risk: 'caution', reason: '튀김이나 매운 조리법은 위 점막 자극' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 0, risk: 'safe', reason: '직접적 영향 없음' },
    },
  },
  '우유': {
    score: 82,
    summary: '우유는 칼슘과 단백질, 비타민 D가 풍부한 완전식품으로 뼈 건강과 근육 유지에 도움이 됩니다.',
    pros: '고품질 단백질, 칼슘과 비타민D, 성장과 골다공증 예방',
    cons: '포화지방과 유당, 신장질환자 인·칼륨 관리 필요, 유당불내증',
    expertAdvice: '저지방 또는 무지방 우유를 선택하면 포화지방 섭취를 줄일 수 있습니다.',
    nutrients: {
      calories: '67kcal/100g',
      protein: '3.3g',
      carbs: '5g',
      fat: '3.4g',
      fiber: '0g',
      sodium: '50mg',
      potassium: '150mg',
      sugar: '5g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 0, risk: 'safe', reason: '유당이 있으나 단백질과 지방이 혈당 상승을 완화' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '칼슘과 펩타이드가 혈압 조절에 도움' },
      '고지혈증': { scoreModifier: -5, risk: 'caution', reason: '전지유의 포화지방이 LDL 증가 가능' },
      '신장질환': { scoreModifier: -10, risk: 'caution', reason: '칼륨과 인이 높아 제한 필요' },
      '심장질환': { scoreModifier: -5, risk: 'caution', reason: '포화지방이 많아 무지방 제품 권장' },
      '간질환': { scoreModifier: 0, risk: 'safe', reason: '적정량 섭취는 간 기능에 큰 부담 없음' },
      '통풍': { scoreModifier: 5, risk: 'safe', reason: '저지방 유제품은 요산 배출을 도울 수 있음' },
      '위장질환': { scoreModifier: -10, risk: 'caution', reason: '유당불내증 환자에게 설사·복통 유발' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '요오드 공급원이나 과다 섭취는 필요 없음' },
      '빈혈': { scoreModifier: -5, risk: 'caution', reason: '칼슘이 철분 흡수를 저해할 수 있음' },
    },
  },
  '요거트': {
    score: 85,
    summary: '요거트는 유산균과 단백질이 풍부해 장내 균형과 면역에 도움이 되는 발효 유제품입니다.',
    pros: '프로바이오틱스, 소화 개선, 단백질 공급, 칼슘',
    cons: '당류 첨가 제품 주의, 유당불내증, 신장질환자 칼륨·인 관리',
    expertAdvice: '무가당, 플레인 제품을 선택하고 과일이나 견과류를 더해 영양 균형을 맞추세요.',
    nutrients: {
      calories: '63kcal/100g',
      protein: '5.3g',
      carbs: '7g',
      fat: '1.5g',
      fiber: '0g',
      sodium: '46mg',
      potassium: '170mg',
      sugar: '7g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 5, risk: 'recommend', reason: '단백질과 지방이 혈당을 완화하며 저당 제품 권장' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '칼슘, 칼륨, 펩타이드가 혈압 조절에 도움' },
      '고지혈증': { scoreModifier: 0, risk: 'safe', reason: '저지방 제품 선택 시 지방 부담 적음' },
      '신장질환': { scoreModifier: -5, risk: 'caution', reason: '칼륨·인 함량으로 제한 필요' },
      '심장질환': { scoreModifier: 5, risk: 'safe', reason: '프로바이오틱스가 염증을 줄이고 지질 프로필 개선' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: '장내 세균 균형이 간-장 축 염증을 완화' },
      '통풍': { scoreModifier: 5, risk: 'safe', reason: '저지방 유제품이 요산 배출에 도움' },
      '위장질환': { scoreModifier: 10, risk: 'recommend', reason: '유산균이 장 건강과 면역을 강화' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 0, risk: 'safe', reason: '직접적 영향은 없으나 단백질 공급' },
    },
  },
  '견과류': {
    score: 80,
    summary: '믹스 견과류는 불포화지방산과 단백질, 미네랄이 풍부하여 심혈관 건강과 포만감을 높입니다.',
    pros: '식물성 단백질, 오메가-3/6, 식이섬유, 미네랄 공급',
    cons: '고칼로리, 알레르기 위험, 신장질환자의 칼륨·인 제한 필요',
    expertAdvice: '하루 한 줌(약 25g) 정도로 생 견과를 섭취하면 이상적인 지질 개선 효과를 볼 수 있습니다.',
    nutrients: {
      calories: '607kcal/100g',
      protein: '20g',
      carbs: '21g',
      fat: '54g',
      fiber: '8g',
      sodium: '5mg',
      potassium: '500mg',
      sugar: '4g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 0, risk: 'safe', reason: '저탄수 식품이지만 칼로리가 높아 양 조절 필요' },
      '고혈압': { scoreModifier: 0, risk: 'safe', reason: '불포화지방이 혈관 건강을 돕지만 염장 제품 주의' },
      '고지혈증': { scoreModifier: 10, risk: 'recommend', reason: '불포화지방이 LDL 감소와 HDL 증가' },
      '신장질환': { scoreModifier: -15, risk: 'warning', reason: '칼륨과 인이 높아 중증 신부전 환자 제한' },
      '심장질환': { scoreModifier: 10, risk: 'recommend', reason: '오메가-3와 아르기닌이 혈관 탄력 개선' },
      '간질환': { scoreModifier: 0, risk: 'safe', reason: '적정량은 간에 부담이 크지 않음' },
      '통풍': { scoreModifier: 0, risk: 'safe', reason: '퓨린 함량이 매우 낮음' },
      '위장질환': { scoreModifier: -5, risk: 'caution', reason: '고지방 식품이라 역류성 식도염 악화 가능' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 5, risk: 'safe', reason: '식물성 철분과 엽산을 제공' },
    },
  },
  '아몬드': {
    score: 88,
    summary: '아몬드는 단백질과 비타민E, 마그네슘이 풍부하여 항산화 및 혈당 조절에 도움을 줍니다.',
    pros: '비타민E 항산화, 식물성 단백질, 식이섬유, 좋은 지방산',
    cons: '고열량, 신장질환자의 칼륨·인 제한, 과다 섭취 시 소화불량',
    expertAdvice: '불린 뒤 섭취하거나 잘 씹어 먹으면 소화가 쉽고 영양 흡수가 잘 됩니다.',
    nutrients: {
      calories: '579kcal/100g',
      protein: '21g',
      carbs: '22g',
      fat: '50g',
      fiber: '12g',
      sodium: '1mg',
      potassium: '733mg',
      sugar: '4.4g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 5, risk: 'recommend', reason: '식이섬유와 마그네슘이 혈당 조절을 지원' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '마그네슘과 칼륨이 혈관 이완에 도움' },
      '고지혈증': { scoreModifier: 10, risk: 'recommend', reason: '단일불포화지방이 LDL 저하' },
      '신장질환': { scoreModifier: -10, risk: 'caution', reason: '칼륨과 인이 높아 제한 필요' },
      '심장질환': { scoreModifier: 10, risk: 'recommend', reason: 'HDL 상승과 혈관 염증 감소' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: '비타민E가 산화 스트레스를 줄임' },
      '통풍': { scoreModifier: 0, risk: 'safe', reason: '퓨린이 매우 낮아 안전' },
      '위장질환': { scoreModifier: -5, risk: 'caution', reason: '고지방으로 역류 환자에게 부담 가능' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 5, risk: 'safe', reason: '철분과 엽산이 빈혈 예방에 기여' },
    },
  },
  '호두': {
    score: 85,
    summary: '호두는 식물성 오메가-3(ALA)와 폴리페놀이 풍부해 뇌와 심혈관 건강에 좋은 견과류입니다.',
    pros: '오메가-3 공급, 항산화, 뇌 기능 지원, 식이섬유',
    cons: '고칼로리, 산패 주의, 신장질환자 칼륨·인 제한',
    expertAdvice: '볶지 않은 생 호두를 소량 섭취하면 지방산 파괴 없이 영양을 얻을 수 있습니다.',
    nutrients: {
      calories: '654kcal/100g',
      protein: '15g',
      carbs: '14g',
      fat: '65g',
      fiber: '6.7g',
      sodium: '2mg',
      potassium: '441mg',
      sugar: '2.6g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 0, risk: 'safe', reason: '혈당 영향은 적지만 칼로리가 높아 양 조절 필요' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '오메가-3와 마그네슘이 혈관 이완' },
      '고지혈증': { scoreModifier: 10, risk: 'recommend', reason: 'LDL를 낮추고 HDL을 증가' },
      '신장질환': { scoreModifier: -10, risk: 'caution', reason: '칼륨·인이 있어 중증 환자 제한' },
      '심장질환': { scoreModifier: 10, risk: 'recommend', reason: '오메가-3가 심혈관 사건 위험을 감소' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: '폴리페놀이 간 염증을 낮춤' },
      '통풍': { scoreModifier: 0, risk: 'safe', reason: '퓨린 함량이 낮음' },
      '위장질환': { scoreModifier: -5, risk: 'caution', reason: '고지방으로 소화가 느려 역류 유발 가능' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: 0, risk: 'safe', reason: '미량의 철분이 있으나 큰 영향 없음' },
    },
  },
  '녹차': {
    score: 90,
    summary: '녹차는 카테킨과 L-테아닌이 풍부한 음료로 항산화 및 집중력 향상에 도움을 줍니다.',
    pros: '강력한 항산화, 지방 대사 촉진, 집중력 상승, 진정 효과',
    cons: '카페인이 불면·심계항진을 유발, 빈혈 환자 철분 흡수 저해, 약물 상호작용',
    expertAdvice: '공복에는 속쓰림을 유발할 수 있으니 식후 30분 이후에 마시고, 저녁 늦게는 피하세요.',
    nutrients: {
      calories: '0kcal/100g',
      protein: '0g',
      carbs: '0g',
      fat: '0g',
      fiber: '0g',
      sodium: '1mg',
      potassium: '8mg',
      sugar: '0g',
    },
    diseaseAnalysis: {
      '당뇨': { scoreModifier: 5, risk: 'recommend', reason: '카테킨이 인슐린 감수성을 개선' },
      '고혈압': { scoreModifier: 5, risk: 'safe', reason: '폴리페놀이 혈관 기능 향상 (카페인 민감자는 주의)' },
      '고지혈증': { scoreModifier: 5, risk: 'safe', reason: '카테킨이 지방 흡수를 억제' },
      '신장질환': { scoreModifier: 0, risk: 'safe', reason: '수분 부담이 적으나 카페인으로 이뇨 촉진' },
      '심장질환': { scoreModifier: 5, risk: 'safe', reason: '항산화가 혈관 염증을 줄이지만 카페인 민감 시 주의' },
      '간질환': { scoreModifier: 5, risk: 'safe', reason: '카테킨이 지방간 감소를 돕지만 고용량 추출물은 피함' },
      '통풍': { scoreModifier: 5, risk: 'safe', reason: '이뇨작용과 항산화로 요산 배출 지원' },
      '위장질환': { scoreModifier: -5, risk: 'caution', reason: '카페인과 탄닌이 위산 분비를 자극' },
      '갑상선질환': { scoreModifier: 0, risk: 'safe', reason: '특이 영향 없음' },
      '빈혈': { scoreModifier: -5, risk: 'caution', reason: '탄닌이 철분 흡수를 방해하므로 식사 직후 섭취 자제' },
    },
  },

};

// 질병별 주의 음식
export const DISEASE_CAUTIONS: Record<string, {
  foods: string[];
  reason: string;
  scoreModifier: number; // 점수 조정값
}> = {
  '당뇨': {
    foods: ['밥', '감자', '바나나', '고구마', '사과'],
    reason: '혈당 상승 가능성이 있어 섭취량 조절이 필요합니다.',
    scoreModifier: -15,
  },
  '고혈압': {
    foods: [],
    reason: '나트륨 함량이 높은 음식은 주의가 필요합니다.',
    scoreModifier: 0,
  },
  '신장질환': {
    foods: ['바나나', '시금치', '감자', '견과류', '아몬드', '호두'],
    reason: '칼륨 함량이 높아 신장 기능에 부담을 줄 수 있습니다.',
    scoreModifier: -20,
  },
  '통풍': {
    foods: ['두부', '닭가슴살'],
    reason: '퓨린 함량으로 인해 요산 수치가 상승할 수 있습니다.',
    scoreModifier: -10,
  },
  '갑상선질환': {
    foods: ['브로콜리', '양배추'],
    reason: '갑상선 호르몬 합성에 영향을 줄 수 있습니다.',
    scoreModifier: -10,
  },
};

// 약물 상호작용 주의 음식
export const DRUG_FOOD_INTERACTIONS: Record<string, {
  foods: string[];
  reason: string;
  scoreModifier: number;
}> = {
  '와파린': {
    foods: ['시금치', '브로콜리', '양배추', '녹차'],
    reason: '비타민K가 풍부하여 와파린의 효과를 감소시킬 수 있습니다.',
    scoreModifier: -25,
  },
  '혈압약': {
    foods: ['바나나', '감자'],
    reason: '칼륨 수치에 영향을 줄 수 있습니다.',
    scoreModifier: -10,
  },
};

/**
 * 규칙 기반 분석 가능 여부 확인
 */
export function canUseRuleBasedAnalysis(foodName: string): boolean {
  const normalizedName = normalizeFoodName(foodName).trim().toLowerCase();
  
  // 정확히 일치하거나, 포함하는 경우
  for (const key of Object.keys(SAFE_FOODS)) {
    if (normalizedName === key || normalizedName.includes(key)) {
      return true;
    }
  }
  return false;
}

/**
 * 응답 압축: detailedAnalysis 경량화 (Result01 전용)
 * Result2는 전체 데이터 사용, Result01은 압축된 데이터 사용
 */
export function compressAnalysisForResult01(detailedAnalysis: any): any {
  if (!detailedAnalysis) return null;
  
  return {
    // 핵심 정보만 유지
    pros: detailedAnalysis.pros || '',
    cons: detailedAnalysis.cons || '',
    warnings: detailedAnalysis.warnings || '',
    expertAdvice: detailedAnalysis.expertAdvice || '',
    summary: detailedAnalysis.summary || '',
    
    // 약물 상호작용 간소화 (개수만)
    drugInteractionCount: detailedAnalysis.medicalAnalysis?.drug_food_interactions?.length || 0,
    
    // 데이터 소스 유지
    dataSources: detailedAnalysis.dataSources || ['AI 분석'],
    mode: detailedAnalysis.mode || 'quick',
    
    // 캐시 정보 유지
    cached: detailedAnalysis.cached,
    cacheHitCount: detailedAnalysis.cacheHitCount,
  };
}

/**
 * 규칙 기반 분석 수행 (계층적 분석 1단계 - Result01 전용)
 */
export function getRuleBasedAnalysis(
  foodName: string,
  diseases: string[],
  medicines: string[]
): {
  score: number;
  analysis: string;
  detailedAnalysis: any;
  dataSource: string;
} | null {
  const normalizedName = normalizeFoodName(foodName).trim().toLowerCase();
  
  // 음식 찾기
  let foodData = null;
  let matchedKey = '';
  for (const [key, data] of Object.entries(SAFE_FOODS)) {
    if (normalizedName === key || normalizedName.includes(key)) {
      foodData = data;
      matchedKey = key;
      break;
    }
  }
  
  if (!foodData) return null;
  
  let finalScore = foodData.score;
  const warnings: string[] = [];
  
  // 질병별 점수 조정
  for (const disease of diseases) {
    const caution = DISEASE_CAUTIONS[disease];
    if (caution && caution.foods.includes(matchedKey)) {
      finalScore += caution.scoreModifier;
      warnings.push(`${disease}: ${caution.reason}`);
    }
  }
  
  // 약물 상호작용 점수 조정
  for (const medicine of medicines) {
    for (const [drug, interaction] of Object.entries(DRUG_FOOD_INTERACTIONS)) {
      if (medicine.includes(drug) && interaction.foods.includes(matchedKey)) {
        finalScore += interaction.scoreModifier;
        warnings.push(`${medicine}: ${interaction.reason}`);
      }
    }
  }
  
  // 점수 범위 제한
  finalScore = Math.max(10, Math.min(100, finalScore));
  
  const analysis = warnings.length > 0
    ? `${foodData.summary}\n⚠️ 주의: ${warnings.join(' / ')}`
    : foodData.summary;
  
  return {
    score: finalScore,
    analysis,
    detailedAnalysis: {
      pros: foodData.pros,
      cons: foodData.cons + (warnings.length > 0 ? ` | ${warnings.join(', ')}` : ''),
      summary: foodData.summary,
      warnings: warnings.join('\n') || '',
      expertAdvice: foodData.expertAdvice,
      dataSources: ['규칙 기반 분석 (AI 미사용)'],
      mode: 'rule-based',
    },
    dataSource: 'rule-based',
  };
}
