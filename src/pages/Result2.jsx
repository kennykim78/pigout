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
const formatUserContext = (userProfile, diseases, medicines) => {
  const parts = [];

  if (userProfile?.age) {
    const ageGroup =
      userProfile.age >= 65
        ? "고령자"
        : userProfile.age >= 50
        ? "중장년층"
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

  // 🆕 전문적인 분석 코멘트 생성 (사용자 정보 포함)
  const getAnalysisComment = () => {
    const goodCount = (pros || []).length;
    const badCount = (cons || []).length;
    const userContext = formatUserContext(userProfile, diseases);
    const diseaseText =
      diseases?.length > 0 ? diseases.slice(0, 2).join(", ") : "";

    if (goodCount === 0 && badCount === 0) return "";

    let baseComment = "";
    if (goodCount > badCount * 2) {
      baseComment = "장점이 우세한 음식입니다.";
    } else if (badCount > goodCount) {
      baseComment = "주의할 점이 더 많은 음식입니다.";
    } else {
      baseComment = "장단점이 균형 있는 음식입니다.";
    }

    // 전문적 코멘트 조합
    if (userContext && diseaseText) {
      return `📋 ${userContext}이시고 ${diseaseText}이 있으시므로, ${baseComment} 특히 주의 항목을 확인하세요.`;
    } else if (diseaseText) {
      return `📋 ${diseaseText} 환자분께 ${baseComment}`;
    } else if (userContext) {
      return `📋 ${userContext}분께 ${baseComment}`;
    }
    return `📋 ${baseComment}`;
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

// 🆕 2. 장단점 분석결과 컴포넌트
const AnalysisSummarySection = ({
  goodPoints = [],
  badPoints = [],
  warnings = [],
  userProfile = {},
  diseases = [],
}) => {
  const goodCount = goodPoints?.length || 0;
  const badCount = badPoints?.length || 0;
  const warningCount = warnings?.length || 0;
  const total = goodCount + badCount + warningCount || 1;
  const positiveRatio = Math.round((goodCount / total) * 100);

  const data = [
    { name: "좋은 점", value: goodCount, color: "#22c55e" },
    { name: "주의 점", value: badCount, color: "#f97316" },
    { name: "경고", value: warningCount, color: "#ef4444" },
  ].filter((item) => item.value > 0);

  const statusIcon =
    positiveRatio >= 70 ? "😊" : positiveRatio >= 40 ? "😐" : "😟";

  // 🆕 전문적인 분석 코멘트
  const getBalanceAnalysis = () => {
    const userContext = formatUserContext(userProfile, diseases);
    const diseaseText = diseases?.length > 0 ? diseases[0] : "";

    let baseAnalysis = "";
    if (positiveRatio >= 80) {
      baseAnalysis = `장점 ${goodCount}개 vs 주의점 ${badCount}개로 긍정적 요소가 압도적입니다.`;
    } else if (positiveRatio >= 60) {
      baseAnalysis = `장점이 ${goodCount}개로 더 많지만 ${badCount}개 주의점도 고려하세요.`;
    } else if (positiveRatio >= 40) {
      baseAnalysis = `장단점이 비슷한 비율입니다. ${
        warningCount > 0 ? `${warningCount}개 경고사항을 확인하세요.` : ""
      }`;
    } else {
      baseAnalysis = `주의점(${badCount}개)이 장점(${goodCount}개)보다 많습니다.`;
    }

    // 사용자 맞춤 코멘트
    if (diseaseText && userProfile?.age >= 50) {
      return `📊 ${userContext}이시고 ${diseaseText}이 있으시므로, ${baseAnalysis} 전문의와 상담 권장드립니다.`;
    } else if (diseaseText) {
      return `📊 ${diseaseText} 환자분께 ${baseAnalysis}`;
    } else if (userContext) {
      return `📊 ${userContext}분께 ${baseAnalysis}`;
    }
    return `📊 ${baseAnalysis}`;
  };

  return (
    <div className="result2-card result2-card--summary">
      <h2 className="result2-card__title">장단점 분석결과</h2>
      <div className="summary-chart">
        <div className="summary-chart__graph">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={
                  data.length > 0
                    ? data
                    : [{ name: "없음", value: 1, color: "#e5e7eb" }]
                }
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {(data.length > 0 ? data : [{ color: "#e5e7eb" }]).map(
                  (entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  )
                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="summary-chart__center">
            <span className="summary-chart__icon">{statusIcon}</span>
            <span className="summary-chart__percent">{positiveRatio}%</span>
          </div>
        </div>
        <div className="summary-chart__legend">
          <span className="legend-item legend-item--good">
            ✅ 장점 {goodCount}개
          </span>
          <span className="legend-item legend-item--bad">
            ⚠️ 주의 {badCount}개
          </span>
          {warningCount > 0 && (
            <span className="legend-item legend-item--warning">
              🚨 경고 {warningCount}개
            </span>
          )}
        </div>
        <p className="result2-card__analysis">{getBalanceAnalysis()}</p>
      </div>
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

  // 🆕 전문적인 영양 분석 코멘트
  const getNutritionAnalysis = () => {
    const userContext = formatUserContext(userProfile, diseases);
    const issues = [];

    // 질병 기반 위험 분석
    if (diseases?.includes("고혈압") && sodium && sodium > 500) {
      issues.push("나트륨 주의(고혈압)");
    }
    if (diseases?.includes("당뇨") && (carbs > 50 || sugar > 10)) {
      issues.push("탄수화물/당류 주의(당뇨)");
    }
    if (diseases?.includes("고지혈증") && fat > 15) {
      issues.push("지방 주의(고지혈증)");
    }
    if (diseases?.includes("신장질환") && potassium && potassium > 300) {
      issues.push("칼륨 주의(신장질환)");
    }

    // 일반적인 위험
    if (riskFactors?.highSodium || (sodium && sodium >= 1000)) {
      if (!issues.some((i) => i.includes("나트륨"))) issues.push("고나트륨");
    }
    if (riskFactors?.highFat || (fat && fat >= 20)) {
      if (!issues.some((i) => i.includes("지방"))) issues.push("고지방");
    }

    if (issues.length === 0) {
      if (protein && protein > 15) {
        return `🥗 ${
          userContext ? userContext + "분께 " : ""
        }고단백 식품으로 균형잡힌 영양 구성입니다.`;
      }
      return `🥗 ${
        userContext ? userContext + "분께 " : ""
      }영양 균형이 양호합니다. 적당량 섭취를 권장합니다.`;
    } else {
      const diseaseNote =
        diseases?.length > 0 ? `${diseases[0]} 환자분은 ` : "";
      return `⚠️ ${diseaseNote}${issues.join(", ")} - ${
        userProfile?.age >= 50
          ? "섭취량 조절 및 전문의 상담 권장"
          : "섭취량 조절 권장"
      }`;
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
  // 🆕 전문적인 분석 코멘트
  const getInteractionAnalysis = () => {
    const userContext = formatUserContext(userProfile, diseases);
    const medicineCount = medicines?.length || interactions?.length || 0;

    if (!interactions || interactions.length === 0) {
      if (medicineCount === 0) {
        return `💊 현재 등록된 복용 약물이 없습니다. 약물을 등록하시면 상호작용 분석을 제공해드립니다.`;
      }
      return `💊 ${medicineCount}개 약물 분석 결과, 이 음식과의 특별한 상호작용이 발견되지 않았습니다.`;
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
      return `🚨 ${
        userContext ? userContext + " " : ""
      }복용 중인 약물 중 ${dangerCount}건의 위험한 상호작용이 있습니다. 반드시 의사/약사와 상담하세요!`;
    } else if (cautionCount > 0) {
      return `⚠️ ${cautionCount}개 약물에 주의가 필요합니다. ${
        userProfile?.age >= 60
          ? "고령자의 경우 특히 섭취 시간과 양을 조절하세요."
          : "섭취 시간/양을 조절하세요."
      }`;
    } else {
      return `✅ 복용 중인 ${safeCount}개 약물과 안전하게 섭취할 수 있습니다.`;
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

  // 🆕 전문적인 분석 코멘트
  const getAnalysisComment = () => {
    const userContext = formatUserContext(userProfile, diseases);
    const diseaseText = diseases?.length > 0 ? diseases[0] : "";

    // 질병별 특수 경고
    const diseaseWarnings = [];
    if (diseases?.includes("고혈압") && correctedRiskFactors.highSodium) {
      diseaseWarnings.push("고혈압-나트륨");
    }
    if (diseases?.includes("당뇨") && correctedRiskFactors.highSugar) {
      diseaseWarnings.push("당뇨-당류");
    }
    if (diseases?.includes("고지혈증") && correctedRiskFactors.highFat) {
      diseaseWarnings.push("고지혈증-지방");
    }
    if (diseases?.includes("신장질환") && correctedRiskFactors.highPotassium) {
      diseaseWarnings.push("신장-칼륨");
    }

    if (diseaseWarnings.length > 0) {
      return `🔬 ${diseaseText} 환자분께 ${diseaseWarnings.join(
        ", "
      )} 조합이 우려됩니다. ${
        userProfile?.age >= 50
          ? "전문의 상담을 권장합니다."
          : "섭취를 자제하세요."
      }`;
    }

    if (detectedRisks.length === 0 && detectedGoods.length > 0) {
      return `🔬 ${userContext ? userContext + "분께 " : ""}${detectedGoods
        .map((g) => g.label)
        .join(", ")} 등 좋은 성분이 풍부합니다!`;
    }
    if (detectedRisks.length === 0) {
      return `🔬 ${
        userContext ? userContext + "분께 " : ""
      }특별히 주의할 성분이 없습니다. 안심하고 드세요!`;
    }
    if (detectedRisks.length <= 2 && detectedGoods.length > 0) {
      return `🔬 ${detectedGoods
        .map((g) => g.label)
        .join(", ")} 장점이 있지만, ${detectedRisks
        .map((r) => r.label)
        .join(", ")}은 ${
        diseaseText ? diseaseText + " 환자분께 " : ""
      }주의가 필요합니다.`;
    }
    return `🔬 ${detectedRisks.map((r) => r.label).join(", ")} 성분이 있어 ${
      userContext ? userContext + "분께 " : ""
    }섭취량 조절이 필요합니다.`;
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

// 🆕 8. 종합 분석 컴포넌트 (상위 분석 내용 모두 취합 + 총평)
const FinalAnalysisSection = ({
  summary,
  expertAdvice,
  foodName,
  userProfile = {},
  diseases = [],
  medicines = [],
  detailedAnalysis = {},
}) => {
  // 🆕 종합 총평 생성
  const generateComprehensiveAnalysis = () => {
    const parts = [];
    const userContext = formatUserContext(userProfile, diseases);
    const genderKo =
      userProfile?.gender === "male"
        ? "남성"
        : userProfile?.gender === "female"
        ? "여성"
        : "";

    // 1. 사용자 프로필 요약
    if (userProfile?.age || genderKo || diseases?.length > 0) {
      let profilePart = `📋 [분석 대상] `;
      const profileItems = [];
      if (userProfile?.age) profileItems.push(`${userProfile.age}세`);
      if (genderKo) profileItems.push(genderKo);
      if (diseases?.length > 0)
        profileItems.push(`${diseases.join(", ")} 환자`);
      if (medicines?.length > 0)
        profileItems.push(`${medicines.length}개 약물 복용 중`);
      profilePart += profileItems.join(" / ");
      parts.push(profilePart);
    }

    // 2. 장단점 요약
    const goodCount =
      detailedAnalysis?.goodPoints?.length ||
      detailedAnalysis?.pros?.length ||
      0;
    const badCount =
      detailedAnalysis?.badPoints?.length ||
      detailedAnalysis?.cons?.length ||
      0;
    const warningCount = detailedAnalysis?.warnings?.length || 0;

    if (goodCount > 0 || badCount > 0) {
      const positiveRatio = Math.round(
        (goodCount / (goodCount + badCount + warningCount || 1)) * 100
      );
      let balancePart = `📊 [장단점 분석] 장점 ${goodCount}개, 주의점 ${badCount}개`;
      if (warningCount > 0) balancePart += `, 경고 ${warningCount}개`;
      balancePart += ` (긍정 비율 ${positiveRatio}%)`;
      parts.push(balancePart);
    }

    // 3. 영양 분석 요약
    const nutrition = detailedAnalysis?.nutrition;
    if (nutrition) {
      let nutritionPart = `🥗 [영양 분석] `;
      const nutritionItems = [];
      if (nutrition.calories) nutritionItems.push(`${nutrition.calories}kcal`);
      if (nutrition.protein)
        nutritionItems.push(`단백질 ${nutrition.protein}g`);
      if (nutrition.sodium) nutritionItems.push(`나트륨 ${nutrition.sodium}mg`);
      nutritionPart += nutritionItems.join(", ");
      parts.push(nutritionPart);
    }

    // 4. 약물 상호작용 요약
    const interactions =
      detailedAnalysis?.medicalAnalysis?.drug_food_interactions || [];
    if (interactions.length > 0 || medicines?.length > 0) {
      const dangerCount = interactions.filter(
        (d) => d.risk_level === "danger"
      ).length;
      const cautionCount = interactions.filter(
        (d) => d.risk_level === "caution"
      ).length;
      let drugPart = `💊 [약물 상호작용] `;
      if (dangerCount > 0) {
        drugPart += `위험 ${dangerCount}건 발견! `;
      } else if (cautionCount > 0) {
        drugPart += `주의 필요 ${cautionCount}건`;
      } else if (medicines?.length > 0) {
        drugPart += `${medicines.length}개 약물 모두 안전`;
      } else {
        drugPart += `등록된 약물 없음`;
      }
      parts.push(drugPart);
    }

    // 5. 성분 분석 요약
    const riskFactors = detailedAnalysis?.riskFactors || {};
    const riskCount = Object.values(riskFactors).filter((v) => v).length;
    if (riskCount > 0) {
      const riskNames = [];
      if (riskFactors.highSodium) riskNames.push("고나트륨");
      if (riskFactors.highFat) riskNames.push("고지방");
      if (riskFactors.highSugar) riskNames.push("고당류");
      if (riskFactors.caffeine) riskNames.push("카페인");
      parts.push(
        `🔬 [성분 분석] 주의 성분: ${riskNames.slice(0, 3).join(", ")}`
      );
    }

    // 6. 최종 총평
    parts.push("");
    parts.push("━━━━━━━━━━━━━━━━━━━━━━━━");

    // 질병별 맞춤 권고
    let finalAdvice = `🎓 [${foodName} 최종 총평]\n`;

    if (diseases?.length > 0) {
      const diseaseAdvices = [];
      if (diseases.includes("고혈압")) {
        if (
          riskFactors.highSodium ||
          (nutrition?.sodium && nutrition.sodium > 500)
        ) {
          diseaseAdvices.push("고혈압 환자에게 나트륨 함량이 우려됩니다");
        } else {
          diseaseAdvices.push("고혈압 환자에게 나트륨 면에서 안전합니다");
        }
      }
      if (diseases.includes("당뇨")) {
        if (nutrition?.carbs > 50 || nutrition?.sugar > 10) {
          diseaseAdvices.push("당뇨 환자에게 탄수화물/당류 조절이 필요합니다");
        } else {
          diseaseAdvices.push("당뇨 환자에게 비교적 안전한 편입니다");
        }
      }
      if (diseases.includes("고지혈증")) {
        if (riskFactors.highFat || (nutrition?.fat && nutrition.fat > 15)) {
          diseaseAdvices.push("고지혈증 환자에게 지방 함량이 높습니다");
        }
      }

      if (diseaseAdvices.length > 0) {
        finalAdvice += diseaseAdvices.join(". ") + ".\n\n";
      }
    }

    // 나이별 권고
    if (userProfile?.age >= 65) {
      finalAdvice += `${userProfile.age}세 고령자의 경우, 소화 기능과 대사 속도를 고려하여 소량씩 나누어 섭취하시는 것을 권장합니다. `;
    } else if (userProfile?.age >= 50) {
      finalAdvice += `${userProfile.age}세 중장년층의 경우, 건강 관리를 위해 영양 균형을 고려하여 섭취하세요. `;
    }

    // 약물 관련 최종 권고
    const dangerDrugs = interactions.filter((d) => d.risk_level === "danger");
    if (dangerDrugs.length > 0) {
      finalAdvice += `\n\n⚠️ 중요: ${dangerDrugs
        .map((d) => d.medicine_name)
        .join(
          ", "
        )}와 함께 섭취 시 위험할 수 있습니다. 반드시 의사/약사와 상담 후 섭취하세요.`;
    }

    // 기본 권고 (expertAdvice 활용)
    if (expertAdvice && !finalAdvice.includes(expertAdvice.substring(0, 20))) {
      finalAdvice += `\n\n${expertAdvice}`;
    }

    parts.push(finalAdvice);

    return parts.join("\n");
  };

  const comprehensiveContent = generateComprehensiveAnalysis();

  return (
    <div className="result2-card result2-card--final">
      <h2 className="result2-card__title">🎓 종합 분석</h2>
      <div className="final-content">
        <pre className="final-content__text">{comprehensiveContent}</pre>
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
    // 프로필 정보 로드
    const profile = getUserProfile();
    if (profile) {
      setUserProfile(profile);
    }

    // 질병 정보 로드
    const savedDiseases = localStorage.getItem("selectedDiseases");
    if (savedDiseases) {
      setDiseases(JSON.parse(savedDiseases));
    }

    // 약물 정보 로드
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

  // 스크롤 이벤트 핸들러
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const cards = container.querySelectorAll(".result2-stack__card");
      const containerTop = container.scrollTop;
      const viewportHeight = window.innerHeight;

      cards.forEach((card, index) => {
        const cardTop = card.offsetTop - containerTop;
        const cardHeight = card.offsetHeight;

        if (cardTop < viewportHeight * 0.3 && cardTop > -cardHeight * 0.5) {
          setActiveCardIndex(index);
        }
      });
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

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
          {/* 1-5: 카드 스택킹 섹션 */}
          <div className="result2-stack">
            <div
              className={`result2-stack__card ${
                activeCardIndex === 0 ? "active" : ""
              }`}
            >
              <TagCloudSection
                pros={detailedAnalysis.pros || detailedAnalysis.goodPoints}
                cons={detailedAnalysis.cons || detailedAnalysis.badPoints}
                userProfile={userProfile}
                diseases={diseases}
              />
            </div>

            <div
              className={`result2-stack__card ${
                activeCardIndex === 1 ? "active" : ""
              }`}
            >
              <AnalysisSummarySection
                goodPoints={detailedAnalysis.goodPoints}
                badPoints={detailedAnalysis.badPoints}
                warnings={detailedAnalysis.warnings}
                userProfile={userProfile}
                diseases={diseases}
              />
            </div>

            <div
              className={`result2-stack__card ${
                activeCardIndex === 2 ? "active" : ""
              }`}
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
              className={`result2-stack__card ${
                activeCardIndex === 3 ? "active" : ""
              }`}
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
              className={`result2-stack__card ${
                activeCardIndex === 4 ? "active" : ""
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
