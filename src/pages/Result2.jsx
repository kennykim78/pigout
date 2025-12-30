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

// 🆕 1. 장단점 태그 클라우드 컴포넌트 (무한 슬라이딩)
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

  // 랜덤 크기 배열 (small, medium, large)
  const sizes = ["small", "medium", "large"];
  const getRandomSize = (idx) => sizes[idx % 3];

  // 태그를 섞기
  const shuffledTags = [...allTags].sort(() => Math.random() - 0.5);

  // 무한 슬라이드를 위해 태그 복제
  const duplicatedTags = [...shuffledTags, ...shuffledTags];

  if (allTags.length === 0) return null;

  return (
    <div className="result2-card result2-card--tagcloud">
      <h2 className="result2-card__title">장단점 분석</h2>
      <div className="tagcloud">
        <div className="tagcloud__track">
          {duplicatedTags.map((tag, idx) => (
            <div
              key={`${tag.id}-${idx}`}
              className={`tagcloud__tag tagcloud__tag--${
                tag.type
              } tagcloud__tag--${getRandomSize(idx)}`}
            >
              <span className="tagcloud__icon">
                {tag.type === "good" ? "👍" : "👎"}
              </span>
              <span className="tagcloud__text">{tag.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 🆕 2. 분석 결과 요약 그래프 컴포넌트
const AnalysisSummarySection = ({
  goodPoints = [],
  badPoints = [],
  warnings = [],
  summary,
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

  // 요약 텍스트 생성
  const getSummaryText = () => {
    if (summary) return summary;
    if (positiveRatio >= 70)
      return "전반적으로 건강에 좋은 음식입니다. 적당량을 섭취하시면 좋습니다.";
    if (positiveRatio >= 40)
      return "장점과 단점이 혼재되어 있습니다. 주의사항을 확인해주세요.";
    return "섭취 시 주의가 필요합니다. 아래 상세 내용을 꼭 확인해주세요.";
  };

  return (
    <div className="result2-card result2-card--summary">
      <h2 className="result2-card__title">분석 결과 요약</h2>
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
        <div className="summary-chart__status">
          <span
            className={`summary-chart__badge summary-chart__badge--${
              positiveRatio >= 70
                ? "good"
                : positiveRatio >= 40
                ? "normal"
                : "bad"
            }`}
          >
            {statusText}
          </span>
        </div>
        <p className="summary-chart__text">{getSummaryText()}</p>
      </div>
    </div>
  );
};

// 🆕 3. 영양성분정보 컴포넌트
const NutritionSection = ({ nutrition, servingSize }) => {
  if (!nutrition) return null;

  const { calories, protein, carbs, fat, sodium } = nutrition;

  const nutritionData = [
    {
      name: "칼로리",
      value: calories,
      unit: "kcal",
      icon: "🔥",
      desc: "에너지원",
    },
    {
      name: "단백질",
      value: protein,
      unit: "g",
      icon: "💪",
      desc: "근육 형성",
    },
    {
      name: "탄수화물",
      value: carbs,
      unit: "g",
      icon: "🍚",
      desc: "두뇌 활동",
    },
    { name: "지방", value: fat, unit: "g", icon: "🥑", desc: "필수 지방산" },
    {
      name: "나트륨",
      value: sodium,
      unit: "mg",
      icon: "🧂",
      desc: "체액 균형",
    },
  ];

  return (
    <div className="result2-card result2-card--nutrition">
      <h2 className="result2-card__title">영양 성분 정보</h2>
      {servingSize && (
        <p className="nutrition__serving">
          {servingSize.amount}
          {servingSize.unit} 기준
        </p>
      )}
      <div className="nutrition__grid">
        {nutritionData.map((item) => (
          <div key={item.name} className="nutrition__item">
            <span className="nutrition__icon">{item.icon}</span>
            <div className="nutrition__value">
              <span className="nutrition__number">{item.value || 0}</span>
              <span className="nutrition__unit">{item.unit}</span>
            </div>
            <span className="nutrition__name">{item.name}</span>
            <span className="nutrition__desc">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 🆕 4. 약물 상호작용 현황 컴포넌트
const DrugInteractionSection = ({ interactions = [] }) => {
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
    </div>
  );
};

// 🆕 5. 위험 성분 분석 컴포넌트
const RiskFactorSection = ({ riskFactors = {}, riskFactorNotes = {} }) => {
  const riskLabels = {
    alcohol: "알코올",
    highSodium: "나트륨",
    highPotassium: "칼륨",
    caffeine: "카페인",
    citrus: "감귤류",
    grapefruit: "자몽",
    dairy: "유제품",
    highFat: "지방",
    vitaminK: "비타민K",
    tyramine: "티라민",
    highSugar: "당류",
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

  const detectedFactors = Object.entries(riskFactors || {})
    .filter(([key, value]) => value && riskLabels[key])
    .map(([key]) => ({
      key,
      label: riskLabels[key],
      icon: riskIcons[key] || "⚠️",
      note: riskFactorNotes?.[key] || "",
    }));

  const getComment = () => {
    if (detectedFactors.length === 0) {
      return "위험 성분이 검출되지 않았습니다. 안심하고 드셔도 됩니다.";
    }
    if (detectedFactors.length <= 2) {
      return `${detectedFactors
        .map((f) => f.label)
        .join(", ")} 성분이 포함되어 있습니다. 적당량 섭취를 권장합니다.`;
    }
    return "여러 주의 성분이 검출되었습니다. 섭취량에 주의해주세요.";
  };

  return (
    <div className="result2-card result2-card--risk">
      <h2 className="result2-card__title">위험 성분 분석</h2>
      <div className="risk-section">
        {detectedFactors.length > 0 ? (
          <div className="risk-section__list">
            {detectedFactors.map((factor) => (
              <div key={factor.key} className="risk-item">
                <span className="risk-item__icon">{factor.icon}</span>
                <span className="risk-item__label">{factor.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="risk-section__empty">
            <span className="risk-section__check">✅</span>
            <span>위험 성분 없음</span>
          </div>
        )}
        <p className="risk-section__comment">{getComment()}</p>
      </div>
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

  // 현재 활성 카드 인덱스 (슬라이딩 애니메이션용)
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

  // 스크롤 이벤트 핸들러 (슬라이딩 애니메이션)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const cards = container.querySelectorAll(".result2-card--slide");
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

      {/* 메인 컨텐츠 */}
      {!isStreaming && detailedAnalysis && (
        <div className="result2__content" ref={containerRef}>
          {/* 1-4: 슬라이딩 카드 섹션 */}
          <div className="result2__slide-section">
            <div
              className={`result2-card--slide ${
                activeCardIndex === 0 ? "active" : ""
              }`}
            >
              <TagCloudSection
                pros={detailedAnalysis.pros || detailedAnalysis.goodPoints}
                cons={detailedAnalysis.cons || detailedAnalysis.badPoints}
              />
            </div>

            <div
              className={`result2-card--slide ${
                activeCardIndex === 1 ? "active" : ""
              }`}
            >
              <AnalysisSummarySection
                goodPoints={detailedAnalysis.goodPoints}
                badPoints={detailedAnalysis.badPoints}
                warnings={detailedAnalysis.warnings}
                summary={detailedAnalysis.summary}
              />
            </div>

            <div
              className={`result2-card--slide ${
                activeCardIndex === 2 ? "active" : ""
              }`}
            >
              <NutritionSection
                nutrition={detailedAnalysis.nutrition}
                servingSize={detailedAnalysis.servingSize}
              />
            </div>

            <div
              className={`result2-card--slide ${
                activeCardIndex === 3 ? "active" : ""
              }`}
            >
              <DrugInteractionSection
                interactions={
                  detailedAnalysis.medicalAnalysis?.drug_food_interactions
                }
              />
            </div>

            <div
              className={`result2-card--slide ${
                activeCardIndex === 4 ? "active" : ""
              }`}
            >
              <RiskFactorSection
                riskFactors={detailedAnalysis.riskFactors}
                riskFactorNotes={detailedAnalysis.riskFactorNotes}
              />
            </div>
          </div>

          {/* 5-7: 일반 스크롤 섹션 */}
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
