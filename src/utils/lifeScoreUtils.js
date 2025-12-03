/**
 * 적합점수(0-100)를 남은 수명 일수 변화량으로 변환
 * 극적인 표현을 위해 +100 ~ -100일 범위 사용
 * 
 * 8단계 점수 기준:
 * - 95-100점: +70 ~ +100일 (완벽)
 * - 85-94점: +40 ~ +69일 (최상)
 * - 75-84점: +15 ~ +39일 (우수)
 * - 65-74점: +1 ~ +14일 (양호)
 * - 50-64점: -1 ~ -14일 (주의)
 * - 35-49점: -15 ~ -39일 (경고)
 * - 20-34점: -40 ~ -69일 (위험)
 * - 0-19점: -70 ~ -100일 (치명)
 */
export const scoreToLifeDays = (score) => {
  if (score >= 95) {
    // 95-100 → +70 ~ +100일 (완벽)
    return Math.round(70 + ((score - 95) / 5) * 30);
  } else if (score >= 85) {
    // 85-94 → +40 ~ +69일 (최상)
    return Math.round(40 + ((score - 85) / 9) * 29);
  } else if (score >= 75) {
    // 75-84 → +15 ~ +39일 (우수)
    return Math.round(15 + ((score - 75) / 9) * 24);
  } else if (score >= 65) {
    // 65-74 → +1 ~ +14일 (양호)
    return Math.round(1 + ((score - 65) / 9) * 13);
  } else if (score >= 50) {
    // 50-64 → -1 ~ -14일 (주의)
    return -Math.round(1 + ((64 - score) / 14) * 13);
  } else if (score >= 35) {
    // 35-49 → -15 ~ -39일 (경고)
    return -Math.round(15 + ((49 - score) / 14) * 24);
  } else if (score >= 20) {
    // 20-34 → -40 ~ -69일 (위험)
    return -Math.round(40 + ((34 - score) / 14) * 29);
  } else {
    // 0-19 → -70 ~ -100일 (치명)
    return -Math.round(70 + ((19 - score) / 19) * 30);
  }
};

/**
 * 수명 일수 변화량에 따른 위트있는 코멘트 생성 (8단계)
 */
export const getLifeComment = (lifeDays) => {
  if (lifeDays >= 70) {
    // +70 ~ +100일 (완벽)
    const comments = [
      '불로장생의\n비법을 찾으셨군요! 🏆',
      '신선님이\n부러워할 식단!',
      '100세는 기본,\n120세 가봅시다! ✨',
      '의학계가\n당신을 연구하고 싶어해요',
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (lifeDays >= 40) {
    // +40 ~ +69일 (최상)
    const comments = [
      '장수마을 이장님이\n인정한 음식!',
      '100세 클럽\n가입 축하드립니다~',
      '건강 유튜버가\n당신을 찾고 있어요',
      '보험회사가\n좋아합니다 👍',
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (lifeDays >= 15) {
    // +15 ~ +39일 (우수)
    const comments = [
      '오늘 식사는\n합격입니다! 👍',
      '건강한 선택이에요!\n본인 칭찬해~',
      '이런 음식만\n드시면 좋겠네요',
      '당신의 세포들이\n환호합니다 🎉',
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (lifeDays >= 1) {
    // +1 ~ +14일 (양호)
    const comments = [
      '나쁘지 않은\n선택이에요!',
      '건강에 플러스!\n잘하셨어요',
      '오늘 하루도\n건강하게~',
      '조금씩\n쌓이는 건강!',
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (lifeDays >= -14) {
    // -1 ~ -14일 (주의)
    const comments = [
      '아... 살짝\n아쉬운데요? 🤔',
      '오늘만\n눈감아 줄게요',
      '다음엔 더 좋은\n선택을... 네?',
      '괜찮아요,\n내일 운동하면 돼요',
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (lifeDays >= -39) {
    // -15 ~ -39일 (경고)
    const comments = [
      '저승사자가\n관심을 보입니다 👀',
      '살빼기 미션\n자동 시작됨...',
      '의사선생님이\n슬퍼하실 것 같아요',
      '헬스장 등록은\n하셨죠...?',
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (lifeDays >= -69) {
    // -40 ~ -69일 (위험)
    const comments = [
      '건강검진\n예약하셨죠? 😅',
      '가족들이\n걱정하겠어요 💦',
      '보험 들어두셨길\n바랍니다...',
      '병원 단골\n예약 완료!',
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else {
    // -70 ~ -100일 (치명)
    const comments = [
      '유서는\n써두셨나요? 📝',
      '천국 or 지옥\n곧 알게 됩니다',
      '마지막 만찬으로\n훌륭한 선택!',
      '다음 생에선\n건강하세요... 🙏',
      '저승사자:\n"드디어 만나네요~"',
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }
};

/**
 * 수명 일수 표시용 포맷
 * @returns {string} "+3일" 또는 "-5일" 형태
 */
export const formatLifeDays = (lifeDays) => {
  if (lifeDays > 0) {
    return `+${lifeDays}일`;
  } else if (lifeDays < 0) {
    return `${lifeDays}일`;
  } else {
    return '0일';
  }
};

/**
 * 수명 일수에 따른 색상 클래스 반환 (8단계)
 */
export const getLifeDaysColorClass = (lifeDays) => {
  if (lifeDays >= 70) return 'life-perfect';    // 금색/황금
  if (lifeDays >= 40) return 'life-excellent';  // 진한 초록
  if (lifeDays >= 15) return 'life-great';      // 초록
  if (lifeDays >= 1) return 'life-good';        // 연두
  if (lifeDays >= -14) return 'life-warning';   // 노랑
  if (lifeDays >= -39) return 'life-caution';   // 주황
  if (lifeDays >= -69) return 'life-danger';    // 빨강
  return 'life-critical';                        // 검정/보라
};

/**
 * 기존 점수 표시와 호환성 유지를 위한 헬퍼
 * 점수와 함께 수명 일수도 반환
 */
export const getScoreWithLifeDays = (score) => {
  const lifeDays = scoreToLifeDays(score);
  return {
    score,
    lifeDays,
    lifeDaysText: formatLifeDays(lifeDays),
    comment: getLifeComment(lifeDays),
    colorClass: getLifeDaysColorClass(lifeDays),
  };
};
