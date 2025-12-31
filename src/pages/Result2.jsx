import "./Result2.scss";
import imgangry from "../assets/images/img_angry.png";
import imghappy from "../assets/images/img_happy.png";
import imgcook from "../assets/images/img_cook.png";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { analyzeFoodByTextStream, getMyMedicines } from "../services/api";
import { getDeviceId } from "../utils/deviceId";
import StreamingPopup from "../components/StreamingPopup";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// 🆕 1. 장단점 워드클라우드 컴포넌트 (Slido 스타일 - 정적 배치)
const TagCloudSection = ({ pros = [], cons = [] }) => {
  // pros와 cons를 섞어서 태그 배열 생성
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

  // 다양한 크기 배열 (Slido 스타일 - 더 다양한 크기)
  const sizes = ["xs", "sm", "md", "lg", "xl"];

  // 시드 기반 랜덤 크기 생성 (일관성 유지)
  const getSize = (idx, text) => {
    const seed = text.length + idx;
    return sizes[seed % sizes.length];
  };

  // 태그를 섞기 (일관된 순서)
  const shuffledTags = [...allTags].sort(
    (a, b) =>
      a.text.length + a.id.charCodeAt(0) - (b.text.length + b.id.charCodeAt(0))
  );

  // 간단한 분석 코멘트 생성
  const getAnalysisComment = () => {
    const goodCount = (pros || []).length;
    const badCount = (cons || []).length;

    if (goodCount === 0 && badCount === 0) return "";

    if (goodCount > badCount * 2) {
      return "👍 장점이 많은 음식입니다. 건강에 도움이 됩니다!";
    } else if (badCount > goodCount) {
      return "⚠️ 주의할 점이 있으니 적당량 섭취를 권장합니다.";
    } else {
      return "✅ 장단점을 고려하여 균형있게 섭취하세요.";
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

// 🆕 2. 장단점 분석결과 컴포넌트 (종합분석과 다른 내용)
const AnalysisSummarySection = ({
  goodPoints = [],
  badPoints = [],
  warnings = [],
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
  const statusText =
    positiveRatio >= 70 ? "양호" : positiveRatio >= 40 ? "보통" : "주의 필요";

  // 🆕 장단점 기반 분석 (종합분석과 다른 내용)
  const getBalanceAnalysis = () => {
    if (goodCount === 0 && badCount === 0) {
      return "분석 데이터를 수집 중입니다.";
    }

    if (positiveRatio >= 80) {
      return `장점 ${goodCount}개 vs 주의점 ${badCount}개로, 긍정적 요소가 압도적입니다. 안심하고 드세요!`;
    } else if (positiveRatio >= 60) {
      return `장점이 ${goodCount}개로 더 많지만, ${badCount}개 주의점도 있어요. 적당히 드시면 좋습니다.`;
    } else if (positiveRatio >= 40) {
      return `장단점이 비슷한 비율이에요. ${
        warningCount > 0
          ? `특히 ${warningCount}개 경고사항을 확인하세요.`
          : "균형있게 섭취하세요."
      }`;
    } else {
      return `주의점(${badCount}개)이 장점(${goodCount}개)보다 많아요. 섭취량 조절이 필요합니다.`;
    }
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

// 🆕 3. 영양성분정보 컴포넌트 (2column + 분석 추가)
const NutritionSection = ({ nutrition, servingSize, riskFactors = {} }) => {
  if (!nutrition) return null;

  const { calories, protein, carbs, fat, sodium, fiber, sugar, potassium } =
    nutrition;

  // 2 column 구조로 변경
  const nutritionData = [
    {
      name: "칼로리",
      value: calories,
      unit: "kcal",
      icon: "🔥",
      highlight: false,
    },
    { name: "단백질", value: protein, unit: "g", icon: "💪", highlight: false },
    { name: "탄수화물", value: carbs, unit: "g", icon: "🍚", highlight: false },
    {
      name: "지방",
      value: fat,
      unit: "g",
      icon: "🥑",
      highlight: riskFactors?.highFat,
    },
    {
      name: "나트륨",
      value: sodium,
      unit: "mg",
      icon: "🧂",
      highlight: riskFactors?.highSodium,
    },
    {
      name: "당류",
      value: sugar || 0,
      unit: "g",
      icon: "🍬",
      highlight: riskFactors?.highSugar,
    },
  ].filter((item) => item.value !== undefined);

  // 영양 분석 코멘트 생성 (riskFactors 기반으로 정확성 확보)
  const getNutritionAnalysis = () => {
    const issues = [];

    // 실제 영양 수치 기반 분석 (riskFactors와 일치)
    if (riskFactors?.highSodium || (sodium && sodium > 1000)) {
      issues.push("나트륨이 높아요");
    }
    if (riskFactors?.highFat || (fat && fat > 20)) {
      issues.push("지방 함량 주의");
    }
    if (riskFactors?.highSugar || (sugar && sugar > 15)) {
      issues.push("당류 함량 주의");
    }

    if (issues.length === 0) {
      if (protein && protein > 15) {
        return "✅ 고단백 식품이에요! 균형잡힌 영양 구성입니다.";
      }
      return "✅ 영양 균형이 좋은 편이에요. 적당량 섭취를 권장합니다.";
    } else if (issues.length === 1) {
      return `⚠️ ${issues[0]}. 하지만 다른 영양소는 괜찮아요!`;
    } else {
      return `⚠️ ${issues.slice(0, 2).join(", ")} - 섭취량 조절이 필요해요.`;
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
const DrugInteractionSection = ({ interactions = [] }) => {
  // 분석 코멘트 생성
  const getInteractionAnalysis = () => {
    if (!interactions || interactions.length === 0) {
      return "등록된 복용 약물이 없거나, 이 음식과의 상호작용이 발견되지 않았습니다.";
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
      return `🚨 위험한 상호작용이 ${dangerCount}건 발견되었습니다. 섭취 전 반드시 확인하세요!`;
    } else if (cautionCount > 0) {
      return `⚠️ 주의가 필요한 약물이 ${cautionCount}개 있어요. 섭취 시간/양을 조절하세요.`;
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

// 🆕 5. 성분 분석 컴포넌트 (위험 + 좋은 성분 함께 표시)
const ComponentAnalysisSection = ({
  riskFactors = {},
  riskFactorNotes = {},
  nutrition = {},
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

  // 좋은 성분 정의
  const goodLabels = {
    highProtein: "고단백",
    highFiber: "고식이섬유",
    lowCalorie: "저칼로리",
    antioxidant: "항산화",
    omega3: "오메가3",
    vitamins: "비타민",
    minerals: "미네랄",
  };

  const goodIcons = {
    highProtein: "💪",
    highFiber: "🌾",
    lowCalorie: "🪶",
    antioxidant: "🍇",
    omega3: "🐟",
    vitamins: "💊",
    minerals: "⚡",
  };

  // 🆕 영양 데이터 기반으로 위험 성분 직접 판단 (정확성 확보)
  const calculateRiskFromNutrition = () => {
    const risks = { ...riskFactors };

    // 나트륨: 1인분 기준 1000mg 이상이면 고나트륨
    if (nutrition?.sodium && nutrition.sodium >= 1000) {
      risks.highSodium = true;
    } else if (nutrition?.sodium !== undefined && nutrition.sodium < 500) {
      // 명확히 낮은 경우 false로 설정
      risks.highSodium = false;
    }

    // 지방: 1인분 기준 20g 이상이면 고지방
    if (nutrition?.fat && nutrition.fat >= 20) {
      risks.highFat = true;
    }

    // 당류: 1인분 기준 15g 이상이면 고당류
    if (nutrition?.sugar && nutrition.sugar >= 15) {
      risks.highSugar = true;
    }

    return risks;
  };

  const correctedRiskFactors = calculateRiskFromNutrition();

  // 위험 성분 필터링
  const detectedRisks = Object.entries(correctedRiskFactors || {})
    .filter(([key, value]) => value && riskLabels[key])
    .map(([key]) => ({
      key,
      label: riskLabels[key],
      icon: riskIcons[key] || "⚠️",
      note: riskFactorNotes?.[key] || "",
      type: "risk",
    }));

  // 좋은 성분 판단 (영양 데이터 기반)
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
  // 나트륨이 낮으면 좋은 점으로 추가
  if (nutrition?.sodium !== undefined && nutrition.sodium < 300) {
    detectedGoods.push({
      key: "lowSodium",
      label: "저나트륨",
      icon: "✨",
      type: "good",
    });
  }

  const getAnalysisComment = () => {
    if (detectedRisks.length === 0 && detectedGoods.length > 0) {
      return `✅ 좋은 성분이 ${detectedGoods.length}가지나! ${detectedGoods
        .map((g) => g.label)
        .join(", ")} 성분이 풍부해요.`;
    }
    if (detectedRisks.length === 0 && detectedGoods.length === 0) {
      return "✅ 특별히 주의할 성분이 없어요. 안심하고 드세요!";
    }
    if (detectedRisks.length <= 2 && detectedGoods.length > 0) {
      return `⚖️ ${detectedGoods
        .map((g) => g.label)
        .join(", ")} 장점이 있지만, ${detectedRisks
        .map((r) => r.label)
        .join(", ")}은 주의하세요.`;
    }
    if (detectedRisks.length <= 2) {
      return `⚠️ ${detectedRisks
        .map((r) => r.label)
        .join(", ")} 성분이 있어요. 적당량 섭취를 권장합니다.`;
    }
    return "⚠️ 여러 주의 성분이 있어요. 섭취량에 주의해주세요.";
  };

  return (
    <div className="result2-card result2-card--component">
      <h2 className="result2-card__title">성분 분석</h2>
      <div className="component-section">
        {/* 좋은 성분 */}
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

        {/* 주의 성분 */}
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

// 🆕 6. 대체 음식 추천 컴포넌트
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

// 🆕 7. 종합 분석 컴포넌트
const FinalAnalysisSection = ({ summary, expertAdvice }) => {
  const content = summary || expertAdvice || "분석이 완료되었습니다.";

  return (
    <div className="result2-card result2-card--final">
      <h2 className="result2-card__title">🎓 종합 분석</h2>
      <div className="final-content">
        <p>{content}</p>
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

  // 스트리밍 관련 상태
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStages, setStreamingStages] = useState([]);
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamError, setStreamError] = useState(null);
  const abortRef = useRef(null);

  // 현재 활성 카드 인덱스 (카드 스택킹용)
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const containerRef = useRef(null);

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

  // 스크롤 이벤트 핸들러 (카드 스택킹 애니메이션)
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

        // 카드가 뷰포트 상단에 가까워지면 활성화
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

      {/* 메인 컨텐츠 - 카드 스택킹 구조 */}
      {!isStreaming && detailedAnalysis && (
        <div className="result2__content" ref={containerRef}>
          {/* 1-5: 카드 스택킹 섹션 */}
          <div className="result2-stack">
            {/* 1. 장단점 분석 */}
            <div
              className={`result2-stack__card ${
                activeCardIndex === 0 ? "active" : ""
              }`}
            >
              <TagCloudSection
                pros={detailedAnalysis.pros || detailedAnalysis.goodPoints}
                cons={detailedAnalysis.cons || detailedAnalysis.badPoints}
              />
            </div>

            {/* 2. 장단점 분석결과 */}
            <div
              className={`result2-stack__card ${
                activeCardIndex === 1 ? "active" : ""
              }`}
            >
              <AnalysisSummarySection
                goodPoints={detailedAnalysis.goodPoints}
                badPoints={detailedAnalysis.badPoints}
                warnings={detailedAnalysis.warnings}
              />
            </div>

            {/* 3. 영양 성분 정보 */}
            <div
              className={`result2-stack__card ${
                activeCardIndex === 2 ? "active" : ""
              }`}
            >
              <NutritionSection
                nutrition={detailedAnalysis.nutrition}
                servingSize={detailedAnalysis.servingSize}
                riskFactors={detailedAnalysis.riskFactors}
              />
            </div>

            {/* 4. 약물 상호작용 현황 */}
            <div
              className={`result2-stack__card ${
                activeCardIndex === 3 ? "active" : ""
              }`}
            >
              <DrugInteractionSection
                interactions={
                  detailedAnalysis.medicalAnalysis?.drug_food_interactions
                }
              />
            </div>

            {/* 5. 성분 분석 (위험 + 좋은 성분) */}
            <div
              className={`result2-stack__card ${
                activeCardIndex === 4 ? "active" : ""
              }`}
            >
              <ComponentAnalysisSection
                riskFactors={detailedAnalysis.riskFactors}
                riskFactorNotes={detailedAnalysis.riskFactorNotes}
                nutrition={detailedAnalysis.nutrition}
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
