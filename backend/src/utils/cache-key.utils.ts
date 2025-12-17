/**
 * 연령대 그룹화 유틸리티
 */

/**
 * 나이를 연령대로 변환 (10세 단위)
 * @param age 나이
 * @returns '10대', '20대', '30대', '40대', '50대', '60대', '70대+'
 */
export function getAgeGroup(age?: number): string {
  if (!age || age < 0) return '미입력';
  if (age < 20) return '10대';
  if (age < 30) return '20대';
  if (age < 40) return '30대';
  if (age < 50) return '40대';
  if (age < 60) return '50대';
  if (age < 70) return '60대';
  return '70대+';
}

/**
 * 성별 정규화
 * @param gender 'male' | 'female' | undefined
 * @returns '남성' | '여성' | '미입력'
 */
export function normalizeGender(gender?: string): string {
  if (!gender) return '미입력';
  return gender === 'male' ? '남성' : gender === 'female' ? '여성' : '미입력';
}

/**
 * 캐시 키 생성 (약물 제외, 연령대 기반)
 * @param foodName 음식명
 * @param age 나이
 * @param gender 성별
 * @returns 캐시 키 (예: "김치찌개_50대_남성")
 */
export function generateFoodCacheKey(foodName: string, age?: number, gender?: string): string {
  const ageGroup = getAgeGroup(age);
  const genderStr = normalizeGender(gender);
  return `${foodName}_${ageGroup}_${genderStr}`;
}

/**
 * 약물 캐시 키 생성 (연령대 기반)
 * @param medicineIds 약물 ID 배열 (정렬된 상태)
 * @param age 나이
 * @param gender 성별
 * @returns 캐시 키 (예: "med1,med2,med3_50대_남성")
 */
export function generateMedicineCacheKey(
  medicineIds: string[],
  age?: number,
  gender?: string
): string {
  const ageGroup = getAgeGroup(age);
  const genderStr = normalizeGender(gender);
  return `${medicineIds.join(',')}_${ageGroup}_${genderStr}`;
}
