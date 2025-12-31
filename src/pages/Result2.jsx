import "./Result2.scss";
import imgangry from "../assets/images/img_angry.png";
import imghappy from "../assets/images/img_happy.png";
import imgcook from "../assets/images/img_cook.png";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { analyzeFoodByTextStream, getMyMedicines } from "../services/api";
import { getDeviceId, getUserProfile } from "../utils/deviceId";
import StreamingPopup from "../components/StreamingPopup";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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

// 🆕 1. 장단점 워드클라우드 컴포넌트
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

  const shuffledTags = [...allTags].sort(
    (a, b) =>
      a.text.length + a.id.charCodeAt(0) - (b.text.length + b.id.charCodeAt(0))
  );

  // 🆕 친근하고 위트있는 분석 코멘트
  const getAnalysisComment = () => {
    const goodCount = (pros || []).length;
    const badCount = (cons || []).length;
    const diseaseText = diseases?.length > 0 ? diseases[0] : "";
    const ageNote = userProfile?.age >= 50 ? ", 건강 챙기세요! 💪" : " 😊";

    if (goodCount === 0 && badCount === 0) return "";

    if (goodCount > badCount * 2) {
      return `와~ 장점이 ${goodCount}개나! ${
        diseaseText ? diseaseText + " 있으셔도 " : ""
      }괜찮은 음식이네요${ageNote}`;
    } else if (badCount > goodCount) {
      return `음... 주의할 점이 좀 있어요. ${
        diseaseText ? diseaseText + " 환자분은 " : ""
      }조심해서 드세요! ⚠️`;
    } else {
      return `장단점이 반반이에요. ${
        diseaseText ? diseaseText + " 고려하시면서 " : ""
      }적당히 즐기세요~${ageNote}`;
    }
  };

  if (allTags.length === 0) return null;

  return (
    <div className="result2-card result2-card--tagcloud">
      <h2 className="result2-card__title">장단점 분석</h2>
      <div className="wordcloud">
        {shuffledTags.map((tag, idx) => (
          <div
            key={tag.id}
            className={`wordcloud__tag wordcloud__tag--${
              tag.type
            } wordcloud__tag--${getSize(idx, tag.text)}`}
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

  // 분석 코멘트
  const getTimingComment = () => {
    const timings = getOptimalTiming();
    const recommended = timings.filter((t) => t.recommended);
    const notRecommended = timings.filter((t) => !t.recommended);
    const medicineGuides = getMedicineTimingGuide();

    if (medicineGuides && medicineGuides.some((g) => g.type === "danger")) {
      return `⚠️ 복용 중인 약과 상호작용이 있어요! 시간 조절보다 섭취 여부를 먼저 확인하세요.`;
    }

    if (notRecommended.length > 0) {
      const avoid = notRecommended[0].time;
      const best = recommended[0]?.time || "적절한 시간";
      return `${best}에 드시는 게 좋고, ${avoid}은 피하시는 게 좋겠어요! 🕐`;
    }

    if (userProfile?.age >= 60) {
      return `어르신은 소화를 위해 천천히, 충분한 시간을 두고 드시는 게 좋아요~ 💝`;
    }

    return `시간 제한 없이 편하게 드셔도 괜찮아요! 😊`;
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

  // 분석 코멘트
  const getPortionComment = () => {
    const portion = calculateRecommendedPortion();
    const freq = getRecommendedFrequency();
    const genderText =
      userProfile?.gender === "male"
        ? "남성"
        : userProfile?.gender === "female"
        ? "여성"
        : "";
    const ageText = userProfile?.age ? `${userProfile.age}세` : "";

    if (portion.multiplier < 0.7) {
      return `${ageText} ${genderText}분의 건강 상태를 고려해 일반 섭취량의 ${Math.round(
        portion.multiplier * 100
      )}%만 드시길 권해요! 🙏`;
    }

    if (portion.reasons.length > 0) {
      return `${portion.reasons.join(", ")}를 위해 ${portion.amount}${
        portion.unit
      }이 적당해요~ 👍`;
    }

    if (freq.frequency === "매일 OK") {
      return `${ageText} ${genderText}분께 적합한 음식이에요! 부담 없이 즐기세요~ 😊`;
    }

    return `권장량을 지키면서 ${freq.frequency} 정도로 즐기시면 좋겠어요! 💪`;
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

// 🆕 3. 영양성분정보 컴포넌트
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

  // 🆕 친근하고 위트있는 영양 분석 코멘트
  const getNutritionAnalysis = () => {
    const issues = [];

    if (diseases?.includes("고혈압") && sodium && sodium > 500) {
      issues.push("나트륨 좀 높아요(고혈압 주의!)");
    }
    if (diseases?.includes("당뇨") && (carbs > 50 || sugar > 10)) {
      issues.push("탄수화물 많아요(당뇨 주의!)");
    }
    if (diseases?.includes("고지혈증") && fat > 15) {
      issues.push("지방 좀 있어요(고지혈증 주의!)");
    }

    if (riskFactors?.highSodium || (sodium && sodium >= 1000)) {
      if (!issues.some((i) => i.includes("나트륨"))) issues.push("나트륨 높음");
    }
    if (riskFactors?.highFat || (fat && fat >= 20)) {
      if (!issues.some((i) => i.includes("지방"))) issues.push("지방 높음");
    }

    if (issues.length === 0) {
      if (protein && protein > 15) {
        return `고단백이라 좋아요! 💪 ${
          userProfile?.age >= 50
            ? "근육 건강에 딱이에요~"
            : "운동하시는 분께 추천!"
        }`;
      }
      return `영양 균형 괜찮아요! 😊 맛있게 드세요~`;
    } else if (issues.length === 1) {
      return `${issues[0]} 🤔 근데 다른 건 괜찮으니까 적당히 드시면 OK!`;
    } else {
      return `${issues.slice(0, 2).join(", ")} ⚠️ 양 조절하면서 드세요~`;
    }
  };

  return (
    <div className="result2-card result2-card--nutrition">
      <h2 className="result2-card__title">영양 성분 정보</h2>
      {servingSize && (
        <p className="nutrition__serving">
          {servingSize.amount}
          {servingSize.unit} 기준
        </p>
      )}
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
      <p className="result2-card__analysis">{getNutritionAnalysis()}</p>
    </div>
  );
};

// 🆕 4. 약물 상호작용 현황 컴포넌트
const DrugInteractionSection = ({
  interactions = [],
  medicines = [],
  userProfile = {},
  diseases = [],
}) => {
  // 🆕 친근하고 위트있는 분석 코멘트
  const getInteractionAnalysis = () => {
    const medicineCount = medicines?.length || interactions?.length || 0;

    if (!interactions || interactions.length === 0) {
      if (medicineCount === 0) {
        return `약 등록이 안 되어 있네요! 복용 중인 약이 있다면 등록해주세요~ 📝`;
      }
      return `${medicineCount}개 약 확인했는데, 이 음식이랑 문제없어요! 안심하고 드세요~ ✅`;
    }

    const dangerCount = interactions.filter(
      (d) => d.risk_level === "danger"
    ).length;
    const cautionCount = interactions.filter(
      (d) => d.risk_level === "caution"
    ).length;
    const safeCount = interactions.filter(
      (d) => d.risk_level === "safe"
    ).length;

    if (dangerCount > 0) {
      return `앗! 위험한 조합이 ${dangerCount}개 있어요! 🚨 꼭 의사/약사 선생님께 확인하세요!`;
    } else if (cautionCount > 0) {
      return `${cautionCount}개 약은 좀 조심해야 해요~ ${
        userProfile?.age >= 60
          ? "어르신은 특히 시간/양 조절하세요!"
          : "시간 간격 두고 드세요!"
      } ⚠️`;
    } else {
      return `${safeCount}개 약 모두 OK! 맘 편히 드셔도 돼요~ 😊`;
    }
  };

  if (!interactions || interactions.length === 0) {
    return (
      <div className="result2-card result2-card--drug">
        <h2 className="result2-card__title">약물 상호작용 현황</h2>
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

  const dangerDrugs = interactions.filter((d) => d.risk_level === "danger");
  const cautionDrugs = interactions.filter((d) => d.risk_level === "caution");
  const safeDrugs = interactions.filter((d) => d.risk_level === "safe");

  return (
    <div className="result2-card result2-card--drug">
      <h2 className="result2-card__title">약물 상호작용 현황</h2>
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
          <div key={`caution-${idx}`} className="drug-item drug-item--caution">
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
      <p className="result2-card__analysis">{getInteractionAnalysis()}</p>
    </div>
  );
};

// 🆕 5. 성분 분석 컴포넌트
const ComponentAnalysisSection = ({
  riskFactors = {},
  riskFactorNotes = {},
  nutrition = {},
  userProfile = {},
  diseases = [],
}) => {
  const riskLabels = {
    alcohol: "알코올",
    highSodium: "고나트륨",
    highPotassium: "고칼륨",
    caffeine: "카페인",
    citrus: "감귤류",
    grapefruit: "자몽",
    dairy: "유제품",
    highFat: "고지방",
    vitaminK: "비타민K",
    tyramine: "티라민",
    highSugar: "고당류",
    highCholesterol: "콜레스테롤",
  };

  const riskIcons = {
    alcohol: "🍺",
    highSodium: "🧂",
    highPotassium: "🍌",
    caffeine: "☕",
    citrus: "🍊",
    grapefruit: "🍊",
    dairy: "🥛",
    highFat: "🥓",
    vitaminK: "🥬",
    tyramine: "🧀",
    highSugar: "🍬",
    highCholesterol: "🥚",
  };

  // 영양 데이터 기반으로 위험 성분 직접 판단
  const calculateRiskFromNutrition = () => {
    const risks = { ...riskFactors };

    if (nutrition?.sodium && nutrition.sodium >= 1000) {
      risks.highSodium = true;
    } else if (nutrition?.sodium !== undefined && nutrition.sodium < 500) {
      risks.highSodium = false;
    }

    if (nutrition?.fat && nutrition.fat >= 20) {
      risks.highFat = true;
    }

    if (nutrition?.sugar && nutrition.sugar >= 15) {
      risks.highSugar = true;
    }

    return risks;
  };

  const correctedRiskFactors = calculateRiskFromNutrition();

  const detectedRisks = Object.entries(correctedRiskFactors || {})
    .filter(([key, value]) => value && riskLabels[key])
    .map(([key]) => ({
      key,
      label: riskLabels[key],
      icon: riskIcons[key] || "⚠️",
      note: riskFactorNotes?.[key] || "",
      type: "risk",
    }));

  const detectedGoods = [];

  if (nutrition?.protein && nutrition.protein >= 15) {
    detectedGoods.push({
      key: "highProtein",
      label: "고단백",
      icon: "💪",
      type: "good",
    });
  }
  if (nutrition?.fiber && nutrition.fiber >= 5) {
    detectedGoods.push({
      key: "highFiber",
      label: "고식이섬유",
      icon: "🌾",
      type: "good",
    });
  }
  if (nutrition?.calories && nutrition.calories <= 200) {
    detectedGoods.push({
      key: "lowCalorie",
      label: "저칼로리",
      icon: "🪶",
      type: "good",
    });
  }
  if (nutrition?.sodium !== undefined && nutrition.sodium < 300) {
    detectedGoods.push({
      key: "lowSodium",
      label: "저나트륨",
      icon: "✨",
      type: "good",
    });
  }

  // 🆕 친근하고 위트있는 분석 코멘트
  const getAnalysisComment = () => {
    const diseaseText = diseases?.length > 0 ? diseases[0] : "";

    // 질병별 특수 경고
    const diseaseWarnings = [];
    if (diseases?.includes("고혈압") && correctedRiskFactors.highSodium) {
      diseaseWarnings.push("나트륨+고혈압");
    }
    if (diseases?.includes("당뇨") && correctedRiskFactors.highSugar) {
      diseaseWarnings.push("당류+당뇨");
    }
    if (diseases?.includes("고지혈증") && correctedRiskFactors.highFat) {
      diseaseWarnings.push("지방+고지혈증");
    }

    if (diseaseWarnings.length > 0) {
      return `앗, ${diseaseWarnings.join(", ")} 조합이에요! 😬 ${
        userProfile?.age >= 50
          ? "건강 생각해서 조금만 드세요~"
          : "조심하면서 드세요!"
      }`;
    }

    if (detectedRisks.length === 0 && detectedGoods.length > 0) {
      return `우와~ ${detectedGoods
        .map((g) => g.label)
        .join(", ")} 좋은 성분이 가득! 🌟 맛있게 드세요~`;
    }
    if (detectedRisks.length === 0) {
      return `주의할 성분 없어요! ✅ 마음 편히 드셔도 됩니다~`;
    }
    if (detectedRisks.length <= 2 && detectedGoods.length > 0) {
      return `${detectedGoods
        .map((g) => g.label)
        .join(", ")} 좋지만, ${detectedRisks
        .map((r) => r.label)
        .join(", ")}만 주의하세요! 😊`;
    }
    return `${detectedRisks
      .map((r) => r.label)
      .join(", ")} 있어요~ 적당히 드시는 게 좋겠어요! ⚠️`;
  };

  return (
    <div className="result2-card result2-card--component">
      <h2 className="result2-card__title">성분 분석</h2>
      <div className="component-section">
        {detectedGoods.length > 0 && (
          <div className="component-group">
            <h3 className="component-group__title">👍 좋은 성분</h3>
            <div className="component-list">
              {detectedGoods.map((item) => (
                <div
                  key={item.key}
                  className="component-item component-item--good"
                >
                  <span className="component-item__icon">{item.icon}</span>
                  <span className="component-item__label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detectedRisks.length > 0 ? (
          <div className="component-group">
            <h3 className="component-group__title">⚠️ 주의 성분</h3>
            <div className="component-list">
              {detectedRisks.map((factor) => (
                <div
                  key={factor.key}
                  className="component-item component-item--risk"
                >
                  <span className="component-item__icon">{factor.icon}</span>
                  <span className="component-item__label">{factor.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="component-group">
            <div className="component-empty">
              <span className="component-empty__check">✅</span>
              <span>주의 성분 없음</span>
            </div>
          </div>
        )}
      </div>
      <p className="result2-card__analysis">{getAnalysisComment()}</p>
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
  // 🆕 최종 총평만 생성 (요약 부분 제거)
  const generateFinalAdvice = () => {
    const genderKo =
      userProfile?.gender === "male"
        ? "남성"
        : userProfile?.gender === "female"
        ? "여성"
        : "";
    const interactions =
      detailedAnalysis?.medicalAnalysis?.drug_food_interactions || [];
    const riskFactors = detailedAnalysis?.riskFactors || {};
    const nutrition = detailedAnalysis?.nutrition || {};

    const parts = [];

    // 1. 질병별 맞춤 권고
    if (diseases?.length > 0) {
      const diseaseAdvices = [];

      if (diseases.includes("고혈압")) {
        if (
          riskFactors.highSodium ||
          (nutrition?.sodium && nutrition.sodium > 500)
        ) {
          diseaseAdvices.push(
            "고혈압이 있으시니 나트륨 함량이 좀 걱정돼요. 국물은 남기시는 게 좋겠어요"
          );
        } else {
          diseaseAdvices.push("고혈압 환자분께 나트륨 면에서는 괜찮아 보여요");
        }
      }

      if (diseases.includes("당뇨")) {
        if (nutrition?.carbs > 50 || nutrition?.sugar > 10) {
          diseaseAdvices.push(
            "당뇨가 있으시면 탄수화물/당류가 좀 많아서 양 조절이 필요해요"
          );
        } else {
          diseaseAdvices.push("당뇨 환자분께 비교적 안전한 편이에요");
        }
      }

      if (diseases.includes("고지혈증")) {
        if (riskFactors.highFat || (nutrition?.fat && nutrition.fat > 15)) {
          diseaseAdvices.push(
            "고지혈증이 있으시면 지방 함량이 조금 높은 편이에요"
          );
        }
      }

      if (diseases.includes("신장질환")) {
        if (riskFactors.highPotassium) {
          diseaseAdvices.push("신장질환이 있으시면 칼륨 함량을 주의하세요");
        }
      }

      if (diseaseAdvices.length > 0) {
        parts.push(diseaseAdvices.join(". ") + ".");
      }
    }

    // 2. 나이별 권고
    if (userProfile?.age >= 65) {
      parts.push(
        `\n\n${userProfile.age}세 어르신이시니까, 소화도 생각해서 천천히 소량씩 드시는 게 좋겠어요~ 💝`
      );
    } else if (userProfile?.age >= 50) {
      parts.push(
        `\n\n${userProfile.age}세 중년의 건강을 위해, 균형 잡힌 식사와 함께 드시면 더 좋아요! 🥗`
      );
    }

    // 3. 약물 관련 최종 권고
    const dangerDrugs = interactions.filter((d) => d.risk_level === "danger");
    const cautionDrugs = interactions.filter((d) => d.risk_level === "caution");

    if (dangerDrugs.length > 0) {
      parts.push(
        `\n\n⚠️ 중요! ${dangerDrugs
          .map((d) => d.medicine_name)
          .join(
            ", "
          )}을(를) 드시고 계시니까 이 음식은 조심하셔야 해요. 꼭 의사/약사 선생님과 상담하세요!`
      );
    } else if (cautionDrugs.length > 0) {
      parts.push(
        `\n\n💊 ${cautionDrugs
          .map((d) => d.medicine_name)
          .join(", ")} 약과는 시간 간격을 두고 드시는 게 좋겠어요~`
      );
    }

    // 4. 기본 권고 (expertAdvice 활용 또는 기본 메시지)
    if (parts.length === 0) {
      if (expertAdvice) {
        parts.push(expertAdvice);
      } else if (summary) {
        parts.push(summary);
      } else {
        parts.push(
          `${foodName}은(는) 전반적으로 괜찮은 음식이에요! 😊 적당량 맛있게 드세요~`
        );
      }
    } else if (
      expertAdvice &&
      !parts.some((p) => p.includes(expertAdvice.substring(0, 20)))
    ) {
      parts.push(`\n\n${expertAdvice}`);
    }

    // 5. 마무리 멘트
    if (diseases?.length > 0 || medicines?.length > 0) {
      parts.push(
        `\n\n${
          userProfile?.age >= 50
            ? "건강하게 오래오래 맛있는 거 드세요! 화이팅! 💪"
            : "맛있게 드시고, 건강 챙기세요~! 😊"
        }`
      );
    }

    return parts.join("");
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
  const [medicines, setMedicines] = useState([]);

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

    getMyMedicines(true)
      .then((res) => {
        if (res?.data) {
          setMedicines(res.data.map((m) => m.name || m.item_name));
        }
      })
      .catch((err) => {
        console.log("약물 정보 로드 실패:", err);
      });
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
        startStreamingAnalysis(location.state.foodName);
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
        5 // 최대 6개 카드 (인덱스 0-5)
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
            {activeCardIndex + 1}/6
          </div>

          {/* 1-5: 카드 스택킹 섹션 */}
          <div className="result2-stack">
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

            <div
              className={`result2-stack__card${
                activeCardIndex === 1 ? " active" : ""
              }${activeCardIndex > 1 ? " passed" : ""}`}
            >
              <TimingGuideSection
                nutrition={detailedAnalysis.nutrition}
                riskFactors={detailedAnalysis.riskFactors}
                interactions={detailedAnalysis.medicalAnalysis?.drug_food_interactions}
                medicines={medicines}
                userProfile={userProfile}
                diseases={diseases}
                foodName={foodName}
              />
            </div>

            <div
              className={`result2-stack__card${
                activeCardIndex === 2 ? " active" : ""
              }${activeCardIndex > 2 ? " passed" : ""}`}
            >
              <PersonalizedPortionSection
                nutrition={detailedAnalysis.nutrition}
                servingSize={detailedAnalysis.servingSize}
                userProfile={userProfile}
                diseases={diseases}
                foodName={foodName}
              />
            </div>

            <div
              className={`result2-stack__card${
                activeCardIndex === 3 ? " active" : ""
              }${activeCardIndex > 3 ? " passed" : ""}`}
            >
              <NutritionSection
                nutrition={detailedAnalysis.nutrition}
                servingSize={detailedAnalysis.servingSize}
                riskFactors={detailedAnalysis.riskFactors}
                userProfile={userProfile}
                diseases={diseases}
              />
            </div>

            <div
              className={`result2-stack__card${
                activeCardIndex === 4 ? " active" : ""
              }${activeCardIndex > 4 ? " passed" : ""}`}
            >
              <DrugInteractionSection
                interactions={
                  detailedAnalysis.medicalAnalysis?.drug_food_interactions
                }
                medicines={medicines}
                userProfile={userProfile}
                diseases={diseases}
              />
            </div>

            <div
              className={`result2-stack__card${
                activeCardIndex === 5 ? " active" : ""
              }`}
            >
              <ComponentAnalysisSection
                riskFactors={detailedAnalysis.riskFactors}
                riskFactorNotes={detailedAnalysis.riskFactorNotes}
                nutrition={detailedAnalysis.nutrition}
                userProfile={userProfile}
                diseases={diseases}
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
              medicines={medicines}
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
