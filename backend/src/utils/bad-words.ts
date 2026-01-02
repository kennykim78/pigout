// 간단한 한국어 비속어 리스트 (예시)
// 실제 운영 시 더 정교한 리스트나 외부 API 사용 권장
export const BAD_WORDS = [
  "시발",
  "씨발",
  "개새끼",
  "병신",
  "지랄",
  "좆",
  "썅",
  "미친",
  "닥쳐",
  "꺼져",
  "놈",
  "년",
  "새끼",
  "죽어",
  "자살",
  "살인",
  "마약",
  "도박",
  "섹스",
  "변태",
];

// 비속어 포함 여부 확인 함수
export const containsProfanity = (text: string): boolean => {
  if (!text) return false;
  // 공백 제거 및 소문자 변환 등으로 우회 방지 (기초적 수준)
  const normalized = text.replace(/\s/g, "");
  return BAD_WORDS.some((word) => normalized.includes(word));
};
