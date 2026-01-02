import "./Result2.scss";
import imgangry from "../assets/images/img_angry.png";
import imghappy from "../assets/images/img_happy.png";
import imgcook from "../assets/images/img_cook.png";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { analyzeFoodByTextStream } from "../services/api";
import { getDeviceId, getUserProfile } from "../utils/deviceId";
import StreamingPopup from "../components/StreamingPopup";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAnalysisStore, createUserHash } from "../store/analysisStore";

// 🆕 사용자 프로필 컨텍스트 생성 헬퍼
const formatUserContext = (userProfile, diseases) => {
  const parts = [];

  if (userProfile?.age) {
    const ageGroup =
      userProfile.age >= 65
        ? "어르신"
        : userProfile.age >= 50
        ? "중년"
        : userProfile.age >= 30
        ? "성인"
        : "청년";
    parts.push(`${userProfile.age}세 ${ageGroup}`);
  }

  if (userProfile?.gender) {
    parts.push(userProfile.gender === "male" ? "남성" : "여성");
  }

  return parts.join(" ");
};

// 🆕 1. 장단점 워드클라우드 컴포넌트 (Pulse + Float 애니메이션)
const TagCloudSection = ({
  pros = [],
  cons = [],
  userProfile = {},
  diseases = [],
}) => {
  const allTags = [
    ...(pros || []).map((text, idx) => ({
      text,
      type: "good",
      id: `good-${idx}`,
    })),
    ...(cons || []).map((text, idx) => ({
      text,
      type: "bad",
      id: `bad-${idx}`,
    })),
  ];

  const sizes = ["xs", "sm", "md", "lg", "xl"];

  const getSize = (idx, text) => {
    const seed = text.length + idx;
    return sizes[seed % sizes.length];
  };

  // 🆕 랜덤 애니메이션 딜레이/지속시간 생성
  const getAnimationStyle = (idx, text) => {
    // 텍스트 길이와 인덱스를 기반으로 의사 랜덤 생성 (일관성 유지)
    const seed = text.length * 7 + idx * 13;
    const delay = (seed % 50) / 10; // 0 ~ 5초 딜레이
    const duration = 3 + (seed % 30) / 10; // 3 ~ 6초 지속시간

    return {
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    };
  };

  const shuffledTags = [...allTags].sort(
    (a, b) =>
      a.text.length + a.id.charCodeAt(0) - (b.text.length + b.id.charCodeAt(0))
  );

  // 🆕 친근하고 위트있는 분석 코멘트
  // 🆕 하이브리드: AI 멘트 + 룰베이스 보완 (간결화)
  const getAnalysisComment = () => {
    // 1-2줄로 간결하게 축약
    const goodCount = (pros || []).length;
    const badCount = (cons || []).length;
    const diseaseText = diseases?.length > 0 ? diseases[0] : "";

    if (goodCount > badCount * 2) {
      return `장점이 ${goodCount}개나 되네요! ${
        diseaseText ? "환자분께도 " : ""
      }좋은 선택이 될 수 있어요.`;
    } else if (badCount > goodCount) {
      return `주의할 점이 더 많아요. ${
        diseaseText ? "특히 " : ""
      }섭취에 주의가 필요합니다.`;
    }
    return "장단점이 분명하네요. 적절히 조절해서 드세요.";
  };

  if (allTags.length === 0) return null;

  return (
    <div className="result2-card result2-card--tagcloud">
      <h2 className="result2-card__title">장단점 분석</h2>
      <div className="wordcloud wordcloud--animated">
        {shuffledTags.map((tag, idx) => (
          <div
            key={tag.id}
            className={`wordcloud__tag wordcloud__tag--${
              tag.type
            } wordcloud__tag--${getSize(idx, tag.text)}`}
            style={getAnimationStyle(idx, tag.text)}
          >
            <span className="wordcloud__icon">
              {tag.type === "good" ? "👍" : "👎"}
            </span>
            <span className="wordcloud__text">{tag.text}</span>
          </div>
        ))}
      </div>
      <p className="result2-card__analysis">{getAnalysisComment()}</p>
    </div>
  );
};

// 🆕 2. 섭취 타이밍 가이드 컴포넌트
const TimingGuideSection = ({
  nutrition = {},
  riskFactors = {},
  interactions = [],
  medicines = [],
  userProfile = {},
  diseases = [],
  foodName = "",
}) => {
  // 최적 섭취 시간대 계산
  const getOptimalTiming = () => {
    const timings = [];

    // 카페인 함유 음식
    if (riskFactors?.caffeine) {
      timings.push({
        time: "오전",
        icon: "☀️",
        reason: "카페인이 있어 오후 늦게 드시면 수면에 영향을 줄 수 있어요",
        recommended: true,
      });
      timings.push({
        time: "저녁",
        icon: "🌙",
        reason: "수면 방해 가능성",
        recommended: false,
      });
    }

    // 고탄수화물/고당류 음식 (당뇨 고려)
    if (
      diseases?.includes("당뇨") &&
      (nutrition?.carbs > 40 || nutrition?.sugar > 10)
    ) {
      timings.push({
        time: "식후",
        icon: "🍽️",
        reason: "공복 시 혈당 급상승 방지를 위해 다른 음식과 함께 드세요",
        recommended: true,
      });
      timings.push({
        time: "공복",
        icon: "🚫",
        reason: "혈당 급상승 위험",
        recommended: false,
      });
    }

    // 고지방 음식
    if (riskFactors?.highFat || nutrition?.fat > 20) {
      timings.push({
        time: "점심",
        icon: "🌤️",
        reason: "활동량이 많은 낮에 드시면 에너지로 소비되기 좋아요",
        recommended: true,
      });
      timings.push({
        time: "야식",
        icon: "🌙",
        reason: "소화에 부담, 체지방 축적 위험",
        recommended: false,
      });
    }

    // 고나트륨 음식 (고혈압 고려)
    if (
      diseases?.includes("고혈압") &&
      (riskFactors?.highSodium || nutrition?.sodium > 500)
    ) {
      timings.push({
        time: "점심",
        icon: "🌤️",
        reason: "낮 동안 수분 섭취로 나트륨 배출이 용이해요",
        recommended: true,
      });
    }

    // 기본 타이밍 (아무 특이사항 없을 때)
    if (timings.length === 0) {
      timings.push({
        time: "언제든",
        icon: "✅",
        reason: "특별한 제한 없이 언제 드셔도 괜찮아요",
        recommended: true,
      });
    }

    return timings;
  };

  // 약물 복용 시간과의 간격 가이드
  const getMedicineTimingGuide = () => {
    if (!interactions || interactions.length === 0) return null;

    const guides = [];
    const dangerDrugs = interactions.filter((d) => d.risk_level === "danger");
    const cautionDrugs = interactions.filter((d) => d.risk_level === "caution");

    if (dangerDrugs.length > 0) {
      guides.push({
        type: "danger",
        icon: "🚨",
        medicines: dangerDrugs.map((d) => d.medicine_name).join(", "),
        guide: "이 약을 드시는 동안은 섭취를 피해주세요",
        interval: "섭취 금지",
      });
    }

    if (cautionDrugs.length > 0) {
      guides.push({
        type: "caution",
        icon: "⚠️",
        medicines: cautionDrugs.map((d) => d.medicine_name).join(", "),
        guide: "약 복용 전후 2시간 이상 간격을 두세요",
        interval: "2시간+",
      });
    }

    return guides.length > 0 ? guides : null;
  };

  // 🆕 하이브리드 코멘트
  const getTimingComment = () => {
    const medicineGuides = getMedicineTimingGuide();
    if (medicineGuides && medicineGuides.some((g) => g.type === "danger")) {
      return "⚠️ 약물 상호작용 주의! 섭취 전 전문가와 상의하세요.";
    }

    const timings = getOptimalTiming();
    const notRecommended = timings.filter((t) => !t.recommended);
    const recommended = timings.filter((t) => t.recommended);

    if (notRecommended.length > 0) {
      const best = recommended[0]?.time || "다른 시간";
      return `${best} 섭취를 권장합니다.`;
    }

    return "특별한 시간 제한 없이 드셔도 됩니다.";
  };

  const timings = getOptimalTiming();
  const medicineGuides = getMedicineTimingGuide();

  return (
    <div className="result2-card result2-card--timing">
      <h2 className="result2-card__title">🕐 섭취 타이밍 가이드</h2>
      <div className="timing-section">
        {/* 추천/비추천 시간대 */}
        <div className="timing-grid">
          {timings.map((timing, idx) => (
            <div
              key={idx}
              className={`timing-item ${
                timing.recommended ? "timing-item--good" : "timing-item--bad"
              }`}
            >
              <div className="timing-item__header">
                <span className="timing-item__icon">{timing.icon}</span>
                <span className="timing-item__time">{timing.time}</span>
                <span
                  className={`timing-item__badge ${
                    timing.recommended
                      ? "timing-item__badge--good"
                      : "timing-item__badge--bad"
                  }`}
                >
                  {timing.recommended ? "추천" : "비추천"}
                </span>
              </div>
              <p className="timing-item__reason">{timing.reason}</p>
            </div>
          ))}
        </div>

        {/* 약물 복용 간격 가이드 */}
        {medicineGuides && (
          <div className="timing-medicine">
            <h3 className="timing-medicine__title">💊 약 복용 시 주의</h3>
            {medicineGuides.map((guide, idx) => (
              <div
                key={idx}
                className={`timing-medicine__item timing-medicine__item--${guide.type}`}
              >
                <div className="timing-medicine__header">
                  <span className="timing-medicine__icon">{guide.icon}</span>
                  <span className="timing-medicine__interval">
                    {guide.interval}
                  </span>
                </div>
                <div className="timing-medicine__content">
                  <p className="timing-medicine__drugs">{guide.medicines}</p>
                  <p className="timing-medicine__guide">{guide.guide}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="result2-card__analysis">{getTimingComment()}</p>
    </div>
  );
};

// 🆕 3. 개인 맞춤 권장 섭취량 컴포넌트
const PersonalizedPortionSection = ({
  nutrition = {},
  servingSize = {},
  userProfile = {},
  diseases = [],
  foodName = "",
}) => {
  // 사용자 맞춤 권장량 계산
  const calculateRecommendedPortion = () => {
    const baseAmount = servingSize?.amount || 100;
    const baseUnit = servingSize?.unit || "g";
    let multiplier = 1;
    let reasons = [];

    // 나이별 조정
    if (userProfile?.age >= 65) {
      multiplier *= 0.8;
      reasons.push("어르신 소화력 고려");
    } else if (userProfile?.age >= 50) {
      multiplier *= 0.9;
      reasons.push("대사량 감소 고려");
    }

    // 질병별 조정
    if (
      diseases?.includes("당뇨") &&
      (nutrition?.carbs > 30 || nutrition?.sugar > 10)
    ) {
      multiplier *= 0.7;
      reasons.push("혈당 관리");
    }

    if (diseases?.includes("고혈압") && nutrition?.sodium > 500) {
      multiplier *= 0.7;
      reasons.push("나트륨 제한");
    }

    if (diseases?.includes("고지혈증") && nutrition?.fat > 15) {
      multiplier *= 0.7;
      reasons.push("지방 제한");
    }

    if (diseases?.includes("신장질환") && nutrition?.potassium > 300) {
      multiplier *= 0.6;
      reasons.push("칼륨 제한");
    }

    const recommendedAmount = Math.round(baseAmount * multiplier);

    return {
      amount: recommendedAmount,
      unit: baseUnit,
      multiplier,
      reasons,
      originalAmount: baseAmount,
    };
  };

  // 주간 권장 빈도 계산
  const getRecommendedFrequency = () => {
    let frequency = "매일";
    let icon = "🟢";
    let note = "";

    // 위험 요소 체크
    const hasHighSodium = nutrition?.sodium > 800;
    const hasHighFat = nutrition?.fat > 20;
    const hasHighSugar = nutrition?.sugar > 15;
    const hasHighCalories = nutrition?.calories > 500;

    const riskCount = [
      hasHighSodium,
      hasHighFat,
      hasHighSugar,
      hasHighCalories,
    ].filter(Boolean).length;

    if (riskCount >= 3) {
      frequency = "주 1회";
      icon = "🔴";
      note = "특별한 날에만 드세요";
    } else if (riskCount >= 2) {
      frequency = "주 2-3회";
      icon = "🟡";
      note = "적당히 즐기세요";
    } else if (riskCount >= 1) {
      frequency = "주 3-4회";
      icon = "🟢";
      note = "괜찮은 편이에요";
    } else {
      frequency = "매일 OK";
      icon = "✅";
      note = "규칙적으로 드셔도 좋아요";
    }

    // 질병이 있으면 한 단계 낮춤
    if (diseases?.length > 0 && riskCount >= 1) {
      if (frequency === "매일 OK") {
        frequency = "주 3-4회";
        icon = "🟢";
      } else if (frequency === "주 3-4회") {
        frequency = "주 2-3회";
        icon = "🟡";
      } else if (frequency === "주 2-3회") {
        frequency = "주 1-2회";
        icon = "🟡";
      }
    }

    return { frequency, icon, note };
  };

  // 일일 권장 영양소 대비 비율 계산
  const getDailyValuePercent = () => {
    // 성인 기준 일일 권장량 (근사치)
    const dailyValues = {
      calories: 2000,
      protein: 50,
      carbs: 300,
      fat: 65,
      sodium: 2000,
      sugar: 50,
      fiber: 25,
    };

    const percentages = [];

    if (nutrition?.calories) {
      percentages.push({
        name: "열량",
        percent: Math.round((nutrition.calories / dailyValues.calories) * 100),
        icon: "🔥",
      });
    }
    if (nutrition?.protein) {
      percentages.push({
        name: "단백질",
        percent: Math.round((nutrition.protein / dailyValues.protein) * 100),
        icon: "💪",
      });
    }
    if (nutrition?.carbs) {
      percentages.push({
        name: "탄수화물",
        percent: Math.round((nutrition.carbs / dailyValues.carbs) * 100),
        icon: "🍚",
      });
    }
    if (nutrition?.sodium) {
      percentages.push({
        name: "나트륨",
        percent: Math.round((nutrition.sodium / dailyValues.sodium) * 100),
        icon: "🧂",
      });
    }

    return percentages;
  };

  // 🆕 하이브리드 코멘트
  const getPortionComment = () => {
    const portion = calculateRecommendedPortion();

    if (portion.multiplier < 0.7) {
      return `건강 상태를 고려해 ${Math.round(
        portion.multiplier * 100
      )}% 정도로 줄여 드시는 게 좋습니다.`;
    }
    if (portion.reasons.length > 0) {
      return `${portion.reasons.join(", ")} 관리를 위해 권장량을 지켜주세요.`;
    }
    return `적당량 맛있게 즐기세요.`;
  };

  const portion = calculateRecommendedPortion();
  const freq = getRecommendedFrequency();
  const dailyValues = getDailyValuePercent();

  return (
    <div className="result2-card result2-card--portion">
      <h2 className="result2-card__title">📏 맞춤 권장 섭취량</h2>
      <div className="portion-section">
        {/* 권장 1회 섭취량 */}
        <div className="portion-main">
          <div className="portion-main__amount">
            <span className="portion-main__number">{portion.amount}</span>
            <span className="portion-main__unit">{portion.unit}</span>
          </div>
          <p className="portion-main__label">1회 권장량</p>
          {portion.multiplier < 1 && (
            <p className="portion-main__note">
              일반 기준({portion.originalAmount}
              {portion.unit})의
              {Math.round(portion.multiplier * 100)}%
            </p>
          )}
          {portion.reasons.length > 0 && (
            <div className="portion-main__reasons">
              {portion.reasons.map((reason, idx) => (
                <span key={idx} className="portion-main__reason-tag">
                  {reason}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 주간 권장 빈도 */}
        <div className="portion-frequency">
          <div className="portion-frequency__header">
            <span className="portion-frequency__icon">{freq.icon}</span>
            <span className="portion-frequency__value">{freq.frequency}</span>
          </div>
          <p className="portion-frequency__note">{freq.note}</p>
        </div>

        {/* 일일 영양소 대비 비율 */}
        {dailyValues.length > 0 && (
          <div className="portion-daily">
            <h3 className="portion-daily__title">일일 권장량 대비</h3>
            <div className="portion-daily__grid">
              {dailyValues.map((item, idx) => (
                <div key={idx} className="portion-daily__item">
                  <span className="portion-daily__icon">{item.icon}</span>
                  <span className="portion-daily__name">{item.name}</span>
                  <div className="portion-daily__bar">
                    <div
                      className="portion-daily__fill"
                      style={{ width: `${Math.min(item.percent, 100)}%` }}
                    />
                  </div>
                  <span
                    className={`portion-daily__percent ${
                      item.percent > 50 ? "portion-daily__percent--high" : ""
                    }`}
                  >
                    {item.percent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="result2-card__analysis">{getPortionComment()}</p>
    </div>
  );
};

// 🆕 4. 영양성분정보 + 성분 분석 통합 컴포넌트
const NutritionSection = ({
  nutrition,
  servingSize,
  riskFactors = {},
  userProfile = {},
  diseases = [],
}) => {
  if (!nutrition) return null;

  const { calories, protein, carbs, fat, sodium, fiber, sugar, potassium } =
    nutrition;

  const nutritionData = [
    {
      name: "칼로리",
      value: calories,
      unit: "kcal",
      icon: "🔥",
      highlight: false,
    },
    { name: "단백질", value: protein, unit: "g", icon: "💪", highlight: false },
    {
      name: "탄수화물",
      value: carbs,
      unit: "g",
      icon: "🍚",
      highlight: diseases?.includes("당뇨"),
    },
    {
      name: "지방",
      value: fat,
      unit: "g",
      icon: "🥑",
      highlight: riskFactors?.highFat || diseases?.includes("고지혈증"),
    },
    {
      name: "나트륨",
      value: sodium,
      unit: "mg",
      icon: "🧂",
      highlight: riskFactors?.highSodium || diseases?.includes("고혈압"),
    },
    {
      name: "당류",
      value: sugar || 0,
      unit: "g",
      icon: "🍬",
      highlight: riskFactors?.highSugar || diseases?.includes("당뇨"),
    },
  ].filter((item) => item.value !== undefined);

  // 🆕 좋은 성분 감지
  const getGoodComponents = () => {
    const goods = [];

    if (protein && protein >= 15) {
      goods.push({ key: "highProtein", label: "고단백", icon: "💪" });
    }
    if (fiber && fiber >= 5) {
      goods.push({ key: "highFiber", label: "고식이섬유", icon: "🌾" });
    }
    if (calories && calories <= 200) {
      goods.push({ key: "lowCalorie", label: "저칼로리", icon: "🪶" });
    }
    if (sodium !== undefined && sodium < 300) {
      goods.push({ key: "lowSodium", label: "저나트륨", icon: "✨" });
    }
    if (fat !== undefined && fat < 5) {
      goods.push({ key: "lowFat", label: "저지방", icon: "🥗" });
    }

    return goods;
  };

  // 🆕 주의 성분 감지 (영양 기반)
  const getCautionComponents = () => {
    const cautions = [];

    if (riskFactors?.highSodium || (sodium && sodium >= 800)) {
      cautions.push({ key: "highSodium", label: "고나트륨", icon: "🧂" });
    }
    if (riskFactors?.highFat || (fat && fat >= 20)) {
      cautions.push({ key: "highFat", label: "고지방", icon: "🥓" });
    }
    if (riskFactors?.highSugar || (sugar && sugar >= 15)) {
      cautions.push({ key: "highSugar", label: "고당류", icon: "🍬" });
    }
    if (riskFactors?.highCholesterol) {
      cautions.push({
        key: "highCholesterol",
        label: "고콜레스테롤",
        icon: "🥚",
      });
    }

    return cautions;
  };

  const goodComponents = getGoodComponents();
  const cautionComponents = getCautionComponents();

  if (diseaseWarnings.length > 0) {
    return `⚠️ ${diseaseWarnings.join(", ")} 주의가 필요합니다.`;
  }
  if (cautionComponents.length > 0) {
    return `${cautionComponents
      .map((c) => c.label)
      .join(", ")} 함량이 높으니 주의하세요.`;
  }
  if (goodComponents.length > 0) {
    return "좋은 영양 성분이 풍부하네요!";
  }
  return "영양 성분을 참고하여 섭취하세요.";

  return (
    <div className="result2-card result2-card--nutrition">
      <h2 className="result2-card__title">🍽️ 영양 성분 분석</h2>
      {servingSize && (
        <p className="nutrition__serving">
          {servingSize.amount}
          {servingSize.unit} 기준
        </p>
      )}

      {/* 영양 성분 수치 그리드 */}
      <div className="nutrition__grid nutrition__grid--2col">
        {nutritionData.map((item) => (
          <div
            key={item.name}
            className={`nutrition__item ${
              item.highlight ? "nutrition__item--warning" : ""
            }`}
          >
            <span className="nutrition__icon">{item.icon}</span>
            <div className="nutrition__info">
              <span className="nutrition__name">{item.name}</span>
              <div className="nutrition__value">
                <span className="nutrition__number">{item.value || 0}</span>
                <span className="nutrition__unit">{item.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 🆕 좋은 성분 / 주의 성분 태그 */}
      {(goodComponents.length > 0 || cautionComponents.length > 0) && (
        <div className="nutrition__tags">
          {goodComponents.length > 0 && (
            <div className="nutrition__tag-group">
              <span className="nutrition__tag-label">👍 좋은 점</span>
              <div className="nutrition__tag-list">
                {goodComponents.map((item) => (
                  <span
                    key={item.key}
                    className="nutrition__tag nutrition__tag--good"
                  >
                    {item.icon} {item.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {cautionComponents.length > 0 && (
            <div className="nutrition__tag-group">
              <span className="nutrition__tag-label">⚠️ 주의할 점</span>
              <div className="nutrition__tag-list">
                {cautionComponents.map((item) => (
                  <span
                    key={item.key}
                    className="nutrition__tag nutrition__tag--caution"
                  >
                    {item.icon} {item.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="result2-card__analysis">{getNutritionAnalysis()}</p>
    </div>
  );
};

// 🆕 5. 약물 상호작용 + 약물 관련 위험 성분 통합 컴포넌트
const DrugInteractionSection = ({
  interactions = [],
  medicines = [],
  riskFactors = {},
  userProfile = {},
  diseases = [],
}) => {
  // 약물 관련 위험 성분 (약과 상호작용 가능성 있는 식품 성분)
  const drugRelatedRisks = {
    alcohol: {
      label: "알코올",
      icon: "�",
      warning: "대부분의 약물과 상호작용 위험",
    },
    caffeine: {
      label: "카페인",
      icon: "☕",
      warning: "심혈관계 약물, 수면제와 상호작용",
    },
    grapefruit: {
      label: "자몽",
      icon: "🍊",
      warning: "고혈압약, 스타틴과 상호작용",
    },
    citrus: { label: "감귤류", icon: "🍋", warning: "일부 약물 흡수에 영향" },
    dairy: { label: "유제품", icon: "🥛", warning: "항생제 흡수 방해 가능" },
    vitaminK: {
      label: "비타민K",
      icon: "🥬",
      warning: "와파린 효과 감소 가능",
    },
    tyramine: { label: "티라민", icon: "🧀", warning: "MAO억제제와 상호작용" },
    highPotassium: {
      label: "고칼륨",
      icon: "🍌",
      warning: "ACE억제제와 함께 주의",
    },
  };

  // 음식에 포함된 약물 관련 위험 성분 감지
  const detectedDrugRisks = Object.entries(riskFactors || {})
    .filter(([key, value]) => value && drugRelatedRisks[key])
    .map(([key]) => ({
      key,
      ...drugRelatedRisks[key],
    }));

  // 🆕 하이브리드 코멘트: 데이터 기반 팩트 위주 + 간결함
  const getInteractionAnalysis = () => {
    if (!interactions || interactions.length === 0) {
      if (detectedDrugRisks.length > 0) {
        return "약물 상호작용 위험 성분이 있습니다. 복용 약과 간격을 두세요.";
      }
      return "발견된 약물 상호작용 위험이 없습니다. (등록된 약 기준)";
    }

    const dangerCount = interactions.filter(
      (d) => d.risk_level === "danger"
    ).length;
    const cautionCount = interactions.filter(
      (d) => d.risk_level === "caution"
    ).length;

    if (dangerCount > 0) {
      return `🚨 위험한 상호작용이 ${dangerCount}건 있습니다. 섭취를 자제하세요!`;
    } else if (cautionCount > 0) {
      return `⚠️ 주의가 필요한 상호작용이 ${cautionCount}건 있습니다. 시간 간격을 두세요.`;
    }
    return "약물 상호작용 문제 없이 드실 수 있습니다.";
  };

  const hasAnyInteraction = interactions && interactions.length > 0;
  const hasDrugRisks = detectedDrugRisks.length > 0;

  if (!hasAnyInteraction && !hasDrugRisks) {
    return (
      <div className="result2-card result2-card--drug">
        <h2 className="result2-card__title">💊 약물 상호작용</h2>
        <div className="drug-section drug-section--empty">
          <span className="drug-section__icon">✅</span>
          <p className="drug-section__text">
            등록된 약물이 없거나 상호작용이 발견되지 않았습니다.
          </p>
        </div>
        <p className="result2-card__analysis">{getInteractionAnalysis()}</p>
      </div>
    );
  }

  const dangerDrugs =
    interactions?.filter((d) => d.risk_level === "danger") || [];
  const cautionDrugs =
    interactions?.filter((d) => d.risk_level === "caution") || [];
  const safeDrugs = interactions?.filter((d) => d.risk_level === "safe") || [];

  return (
    <div className="result2-card result2-card--drug">
      <h2 className="result2-card__title">💊 약물 상호작용</h2>

      {/* 🆕 약물 관련 위험 성분 표시 */}
      {hasDrugRisks && (
        <div className="drug-risks">
          <h3 className="drug-risks__title">⚠️ 이 음식에 포함된 주의 성분</h3>
          <div className="drug-risks__list">
            {detectedDrugRisks.map((risk) => (
              <div key={risk.key} className="drug-risks__item">
                <span className="drug-risks__icon">{risk.icon}</span>
                <div className="drug-risks__content">
                  <span className="drug-risks__label">{risk.label}</span>
                  <span className="drug-risks__warning">{risk.warning}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 약물별 상호작용 */}
      {hasAnyInteraction && (
        <div className="drug-section">
          {dangerDrugs.map((drug, idx) => (
            <div key={`danger-${idx}`} className="drug-item drug-item--danger">
              <div className="drug-item__header">
                <span className="drug-item__badge">🚨 위험</span>
                <span className="drug-item__name">{drug.medicine_name}</span>
              </div>
              <p className="drug-item__message">
                {drug.interaction_description ||
                  drug.recommendation ||
                  "섭취를 피해주세요."}
              </p>
            </div>
          ))}
          {cautionDrugs.map((drug, idx) => (
            <div
              key={`caution-${idx}`}
              className="drug-item drug-item--caution"
            >
              <div className="drug-item__header">
                <span className="drug-item__badge">⚠️ 주의</span>
                <span className="drug-item__name">{drug.medicine_name}</span>
              </div>
              <p className="drug-item__message">
                {drug.interaction_description ||
                  drug.recommendation ||
                  "주의해서 섭취하세요."}
              </p>
            </div>
          ))}
          {safeDrugs.map((drug, idx) => (
            <div key={`safe-${idx}`} className="drug-item drug-item--safe">
              <div className="drug-item__header">
                <span className="drug-item__badge">✅ 안전</span>
                <span className="drug-item__name">{drug.medicine_name}</span>
              </div>
              <p className="drug-item__message">
                {drug.interaction_description || "안전하게 섭취할 수 있습니다."}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="result2-card__analysis">{getInteractionAnalysis()}</p>
    </div>
  );
};

// 🆕 6. 스마트 레시피 컴포넌트
const SmartRecipeSection = ({ recipe }) => {
  if (!recipe) return null;

  return (
    <div className="result2-card result2-card--recipe">
      <h2 className="result2-card__title">🥗 스마트 레시피</h2>
      {recipe.videoId && (
        <div className="recipe-video">
          <iframe
            src={`https://www.youtube.com/embed/${recipe.videoId}`}
            title="Recipe Video"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}
      <div className="recipe-content">
        <div className="recipe-item">
          <span className="recipe-item__icon">🔄</span>
          <div className="recipe-item__text">
            <strong>재료 대체:</strong>{" "}
            {recipe.substitutes || "특별한 대체 팁 없음"}
          </div>
        </div>
        <div className="recipe-item">
          <span className="recipe-item__icon">🍳</span>
          <div className="recipe-item__text">
            <strong>조리법:</strong>{" "}
            {recipe.cookingMethod || "일반적인 조리법 사용"}
          </div>
        </div>
        <div className="recipe-item">
          <span className="recipe-item__icon">🍽️</span>
          <div className="recipe-item__text">
            <strong>섭취 가이드:</strong>{" "}
            {recipe.intakeGuide || "적당량 섭취 권장"}
          </div>
        </div>
      </div>
    </div>
  );
};

// 🆕 7. 대체 음식 추천 컴포넌트
const AlternativeFoodSection = ({ alternatives = [] }) => {
  if (!alternatives || alternatives.length === 0) return null;

  return (
    <div className="result2-card result2-card--alternative">
      <h2 className="result2-card__title">🔄 대신 이건 어때요?</h2>
      <div className="alternative-list">
        {alternatives.map((item, idx) => (
          <div key={idx} className="alternative-item">
            <div className="alternative-item__image">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} />
              ) : (
                <span className="alternative-item__placeholder">
                  {item.name?.charAt(0)}
                </span>
              )}
            </div>
            <div className="alternative-item__content">
              <h4 className="alternative-item__name">{item.name}</h4>
              <p className="alternative-item__reason">{item.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 🆕 8. 종합 분석 컴포넌트 (요약 없이 바로 최종 총평)
const FinalAnalysisSection = ({
  summary,
  expertAdvice,
  foodName,
  userProfile = {},
  diseases = [],
  medicines = [],
  detailedAnalysis = {},
}) => {
  // 🆕 하이브리드: AI 멘트 우선 + 중요 안전 경고 덧붙이기
  const generateFinalAdvice = () => {
    // 1. AI 생성 멘트 (최우선) -- 1~2줄로 짧게 축약됨을 가정
    let mainAdvice = expertAdvice || summary || "전반적으로 무난한 음식입니다.";

    // 2. 룰베이스: 치명적인 위험 요소만 짧고 굵게 추가 (안전 장치)
    const criticalWarnings = [];
    const interactions =
      detailedAnalysis?.medicalAnalysis?.drug_food_interactions || [];
    const dangerDrugs = interactions.filter((d) => d.risk_level === "danger");

    // 약물 충돌 경고
    if (dangerDrugs.length > 0) {
      criticalWarnings.push(
        `🚨 [경고] ${dangerDrugs[0].medicine_name} 등 복용 약과 충돌 위험!`
      );
    } else if (
      diseases?.includes("당뇨") &&
      detailedAnalysis?.nutrition?.sugar > 10
    ) {
      // 질병 관련 핵심 경고 예시
      criticalWarnings.push("⚠️ 당뇨 관리: 당류 주의");
    }

    if (criticalWarnings.length > 0) {
      return `${mainAdvice}\n\n${criticalWarnings.join("\n")}`;
    }

    return mainAdvice;
  };

  const finalContent = generateFinalAdvice();

  return (
    <div className="result2-card result2-card--final">
      <h2 className="result2-card__title">🎓 종합 분석</h2>
      <div className="final-content">
        <p className="final-content__text">{finalContent}</p>
      </div>
    </div>
  );
};

// 메인 Result2 컴포넌트
const Result2 = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [foodName, setFoodName] = useState("김치찌개");
  const [foodImage, setFoodImage] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [detailedAnalysis, setDetailedAnalysis] = useState(null);

  // 🆕 사용자 프로필 상태
  const [userProfile, setUserProfile] = useState({});
  const [diseases, setDiseases] = useState([]);
  // const [medicines, setMedicines] = useState([]); // 제거 최적화

  // 스트리밍 관련 상태
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStages, setStreamingStages] = useState([]);
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamError, setStreamError] = useState(null);
  const abortRef = useRef(null);

  // 현재 활성 카드 인덱스
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const containerRef = useRef(null);

  // 🆕 사용자 정보 로드
  useEffect(() => {
    const profile = getUserProfile();
    if (profile) {
      setUserProfile(profile);
    }

    const savedDiseases = localStorage.getItem("selectedDiseases");
    if (savedDiseases) {
      setDiseases(JSON.parse(savedDiseases));
    }

    // 🆕 최적화: getMyMedicines 호출 제거
    // 약물 개수나 리스트가 필요하다면 API 응답(detailedAnalysis)에
    // userMedicineCount 등을 포함시키는 것이 더 효율적입니다.
    // 현재는 상호작용 결과(interactions)에 의존합니다.
  }, []);

  // 스트리밍 분석 시작 함수
  const startStreamingAnalysis = async (foodNameParam) => {
    if (!foodNameParam || foodNameParam.trim() === "") {
      setStreamError("음식 이름이 없습니다.");
      return;
    }

    setIsStreaming(true);
    setStreamError(null);
    setStreamingStages([]);

    const { abort } = analyzeFoodByTextStream(foodNameParam, {
      onStart: (data) => {
        setStreamingStages(
          data.stages.map((name, idx) => ({
            stage: idx + 1,
            name,
            status: "waiting",
          }))
        );
      },
      onStage: (data) => {
        setStreamingStages((prev) =>
          prev.map((s) =>
            s.stage === data.stage
              ? { ...s, status: data.status, message: data.message }
              : s.stage < data.stage
              ? { ...s, status: "complete" }
              : s
          )
        );
        const totalStages = 5;
        const progressPerStage = 100 / totalStages;
        const baseProgress = (data.stage - 1) * progressPerStage;
        const stageProgress =
          data.status === "complete"
            ? progressPerStage
            : progressPerStage * 0.5;
        setStreamProgress(Math.min(baseProgress + stageProgress, 100));
      },
      onResult: (data) => {
        if (data.success && data.data) {
          setAnalysis(data.data.analysis);
          setDetailedAnalysis(data.data.detailedAnalysis);

          // 🆕 캐시에 저장
          const profile = getUserProfile();
          const savedDiseases = localStorage.getItem("selectedDiseases");
          const diseases = savedDiseases ? JSON.parse(savedDiseases) : [];
          const userHash = createUserHash(
            profile?.age,
            profile?.gender,
            diseases
          );
          useAnalysisStore
            .getState()
            .setAnalysis(foodNameParam, data.data.detailedAnalysis, userHash);
        }
        setStreamProgress(100);
        setIsStreaming(false);
      },
      onError: (error) => {
        setStreamError(error.message);
        setIsStreaming(false);
      },
      onComplete: () => {
        setIsStreaming(false);
      },
    });

    abortRef.current = abort;
  };

  useEffect(() => {
    if (location.state) {
      if (location.state.foodName) {
        setFoodName(location.state.foodName);
      }

      let blobUrl = null;
      if (location.state.foodImage) {
        blobUrl = URL.createObjectURL(location.state.foodImage);
        setFoodImage(blobUrl);
      } else if (location.state.imageUrl) {
        setFoodImage(location.state.imageUrl);
      }

      if (location.state.analysis) {
        setAnalysis(location.state.analysis);
      }

      const da = location.state.detailedAnalysis;
      const hasRealDetailedAnalysis =
        da &&
        ((da.goodPoints &&
          Array.isArray(da.goodPoints) &&
          da.goodPoints.length > 0) ||
          (da.badPoints &&
            Array.isArray(da.badPoints) &&
            da.badPoints.length > 0) ||
          da.medicalAnalysis?.drug_food_interactions?.length > 0);

      if (hasRealDetailedAnalysis) {
        setDetailedAnalysis(da);
      } else if (location.state.foodName) {
        // 🆕 캐시 확인
        const profile = getUserProfile();
        const savedDiseases = localStorage.getItem("selectedDiseases");
        const diseases = savedDiseases ? JSON.parse(savedDiseases) : [];
        const userHash = createUserHash(
          profile?.age,
          profile?.gender,
          diseases
        );
        const cached = useAnalysisStore
          .getState()
          .getAnalysis(location.state.foodName, userHash);

        if (cached) {
          console.log("[Result2] 캐시 데이터 사용:", location.state.foodName);
          setDetailedAnalysis(cached);
        } else {
          startStreamingAnalysis(location.state.foodName);
        }
      }

      return () => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        if (abortRef.current) abortRef.current();
      };
    }
  }, [location.state]);

  // 스크롤 이벤트 핸들러 (Sticky Card Stack용)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      // 80vh를 픽셀로 변환
      const cardHeight = window.innerHeight * 0.8;
      // 현재 어느 카드가 보이는지 계산
      const currentIndex = Math.min(
        Math.floor(scrollTop / cardHeight),
        4 // 최대 5개 카드 (인덱스 0-4)
      );
      setActiveCardIndex(currentIndex);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll(); // 초기 상태 설정
    return () => container.removeEventListener("scroll", handleScroll);
  }, [detailedAnalysis]);

  return (
    <div className="result2">
      {/* 헤더 */}
      <header className="result2__header">
        <button className="result2__back-btn" onClick={() => navigate(-1)}>
          <span className="material-symbols-rounded">arrow_back</span>
        </button>
        <h1 className="result2__food-title">[ {foodName} ]</h1>
        <p className="result2__subtitle">
          {isStreaming ? "분석 중이돼지..." : "자세히 분석했돼지!"}
        </p>
        {foodImage && (
          <img src={foodImage} alt={foodName} className="result2__food-image" />
        )}
      </header>

      {/* 스트리밍 분석 팝업 */}
      <StreamingPopup
        isOpen={isStreaming}
        title="AI가 상세 분석 중이에요"
        stages={streamingStages}
        progress={streamProgress}
        onComplete={() => setIsStreaming(false)}
      />

      {/* 에러 표시 */}
      {streamError && (
        <div className="result2__error">
          <p>⚠️ {streamError}</p>
          <button onClick={() => startStreamingAnalysis(foodName)}>
            다시 시도
          </button>
        </div>
      )}

      {/* 분석 데이터 없음 */}
      {!isStreaming && !detailedAnalysis && !streamError && (
        <div className="result2__error">
          <p>⚠️ 분석 결과를 불러오지 못했습니다.</p>
          <button onClick={() => startStreamingAnalysis(foodName)}>
            다시 시도
          </button>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      {!isStreaming && detailedAnalysis && (
        <div className="result2__content" ref={containerRef}>
          {/* 인디케이터 */}
          <div className="result2-stack__indicator">
            {activeCardIndex + 1}/5
          </div>

          {/* 1-5: 카드 스택킹 섹션 */}
          <div className="result2-stack">
            {/* 1. 장단점 워드클라우드 */}
            <div
              className={`result2-stack__card${
                activeCardIndex === 0 ? " active" : ""
              }${activeCardIndex > 0 ? " passed" : ""}`}
            >
              <TagCloudSection
                pros={detailedAnalysis.pros || detailedAnalysis.goodPoints}
                cons={detailedAnalysis.cons || detailedAnalysis.badPoints}
                userProfile={userProfile}
                diseases={diseases}
              />
            </div>

            {/* 2. 영양 성분 분석 (원래 4번) */}
            <div
              className={`result2-stack__card${
                activeCardIndex === 1 ? " active" : ""
              }${activeCardIndex > 1 ? " passed" : ""}`}
            >
              <NutritionSection
                nutrition={detailedAnalysis.nutrition}
                servingSize={detailedAnalysis.servingSize}
                riskFactors={detailedAnalysis.riskFactors}
                userProfile={userProfile}
                diseases={diseases}
              />
            </div>

            {/* 3. 약물 상호작용 (원래 5번) */}
            <div
              className={`result2-stack__card${
                activeCardIndex === 2 ? " active" : ""
              }${activeCardIndex > 2 ? " passed" : ""}`}
            >
              <DrugInteractionSection
                interactions={
                  detailedAnalysis.medicalAnalysis?.drug_food_interactions
                }
                // medicines={medicines} // 제거
                riskFactors={detailedAnalysis.riskFactors}
                userProfile={userProfile}
                diseases={diseases}
              />
            </div>

            {/* 4. 섭취 타이밍 가이드 (원래 2번) */}
            <div
              className={`result2-stack__card${
                activeCardIndex === 3 ? " active" : ""
              }${activeCardIndex > 3 ? " passed" : ""}`}
            >
              <TimingGuideSection
                nutrition={detailedAnalysis.nutrition}
                riskFactors={detailedAnalysis.riskFactors}
                interactions={
                  detailedAnalysis.medicalAnalysis?.drug_food_interactions
                }
                // medicines={medicines} // 제거
                userProfile={userProfile}
                diseases={diseases}
                foodName={foodName}
              />
            </div>

            {/* 5. 맞춤 권장 섭취량 (원래 3번) */}
            <div
              className={`result2-stack__card${
                activeCardIndex === 4 ? " active" : ""
              }`}
            >
              <PersonalizedPortionSection
                nutrition={detailedAnalysis.nutrition}
                servingSize={detailedAnalysis.servingSize}
                userProfile={userProfile}
                diseases={diseases}
                foodName={foodName}
              />
            </div>
          </div>

          {/* 6-8: 일반 스크롤 섹션 */}
          <div className="result2__scroll-section">
            <SmartRecipeSection recipe={detailedAnalysis.recipe} />
            <AlternativeFoodSection
              alternatives={detailedAnalysis.alternatives}
            />
            <FinalAnalysisSection
              summary={detailedAnalysis.summary}
              expertAdvice={detailedAnalysis.expertAdvice}
              foodName={foodName}
              userProfile={userProfile}
              diseases={diseases}
              // medicines={medicines} // 제거
              detailedAnalysis={detailedAnalysis}
            />

            <div className="result2__disclaimer">
              <p>
                ※ 본 결과는 AI 분석 및 공공데이터를 기반으로 하며, 의학적 진단을
                대체할 수 없습니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Result2;
