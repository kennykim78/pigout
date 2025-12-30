import { useState, useEffect } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import "./AnalysisCharts.scss";

// 🆕 위험 성분 게이지 바 차트 (레이더 대체)
export const RiskFactorGaugeChart = ({ riskFactors, riskFactorNotes }) => {
  if (!riskFactors || Object.keys(riskFactors).length === 0) return null;

  const [showSafe, setShowSafe] = useState(false);

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

  // 검출된 위험 성분과 안전한 성분 분리
  const detectedFactors = Object.entries(riskFactors)
    .filter(([key, value]) => value && riskLabels[key])
    .map(([key]) => ({
      key,
      label: riskLabels[key],
      icon: riskIcons[key] || "⚠️",
      note: riskFactorNotes?.[key] || "주의가 필요합니다",
    }));

  const safeFactors = Object.entries(riskFactors)
    .filter(([key, value]) => !value && riskLabels[key])
    .map(([key]) => ({
      key,
      label: riskLabels[key],
      icon: riskIcons[key] || "✅",
    }));

  return (
    <div className="analysis-chart analysis-chart--gauge">
      <h4 className="analysis-chart__title">
        <span className="analysis-chart__icon">🔬</span>
        위험 성분 분석
      </h4>

      <div className="analysis-chart__gauge-container">
        {/* 검출된 위험 성분 */}
        {detectedFactors.length > 0 ? (
          <div className="analysis-chart__gauge-section analysis-chart__gauge-section--danger">
            <p className="analysis-chart__gauge-section-title">⚠️ 주의 성분</p>
            {detectedFactors.map((factor) => (
              <div
                key={factor.key}
                className="analysis-chart__gauge-item analysis-chart__gauge-item--danger"
              >
                <div className="analysis-chart__gauge-header">
                  <span className="analysis-chart__gauge-icon">
                    {factor.icon}
                  </span>
                  <span className="analysis-chart__gauge-label">
                    {factor.label}
                  </span>
                  <span className="analysis-chart__gauge-badge analysis-chart__gauge-badge--danger">
                    검출
                  </span>
                </div>
                <div className="analysis-chart__gauge-bar">
                  <div
                    className="analysis-chart__gauge-fill analysis-chart__gauge-fill--danger"
                    style={{ width: "100%" }}
                  />
                </div>
                <p className="analysis-chart__gauge-note">{factor.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="analysis-chart__gauge-empty">
            <span className="analysis-chart__gauge-empty-icon">✅</span>
            <span className="analysis-chart__gauge-empty-text">
              위험 성분이 검출되지 않았습니다
            </span>
          </div>
        )}

        {/* 안전한 성분 (토글 형태로 변경) */}
        {safeFactors.length > 0 && (
          <div className="analysis-chart__gauge-section analysis-chart__gauge-section--safe">
            <button
              className="analysis-chart__gauge-toggle-btn"
              onClick={() => setShowSafe(!showSafe)}
            >
              <span>
                ✅ 안전 성분 {safeFactors.length}개{" "}
                {showSafe ? "숨기기" : "더보기"}
              </span>
              <span
                className={`analysis-chart__gauge-toggle-icon ${
                  showSafe ? "rotated" : ""
                }`}
              >
                ▼
              </span>
            </button>

            {showSafe && (
              <div className="analysis-chart__gauge-safe-list">
                {safeFactors.map((factor) => (
                  <span
                    key={factor.key}
                    className="analysis-chart__gauge-safe-item"
                  >
                    {factor.icon} {factor.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// 🆕 약물 상호작용 도넛 차트 (개선된 버전)
export const DrugInteractionDonutChart = ({ interactions }) => {
  if (!interactions || interactions.length === 0) return null;

  const dangerCount = interactions.filter(
    (d) => d.risk_level === "danger"
  ).length;
  const cautionCount = interactions.filter(
    (d) => d.risk_level === "caution"
  ).length;
  const safeCount = interactions.filter((d) => d.risk_level === "safe").length;

  const data = [
    { name: "위험", value: dangerCount, color: "#ef5350" },
    { name: "주의", value: cautionCount, color: "#ffa726" },
    { name: "안전", value: safeCount, color: "#66bb6a" },
  ].filter((item) => item.value > 0);

  if (data.length === 0) return null;

  const totalDrugs = interactions.length;

  // 전체 안전도 계산
  const safetyLevel =
    dangerCount > 0 ? "danger" : cautionCount > 0 ? "caution" : "safe";
  const safetyText =
    dangerCount > 0 ? "주의 필요" : cautionCount > 0 ? "양호" : "안전";

  return (
    <div className="analysis-chart analysis-chart--donut">
      <h4 className="analysis-chart__title">
        <span className="analysis-chart__icon">💊</span>
        약물 상호작용 현황
      </h4>
      <div className="analysis-chart__donut-container">
        <div className="analysis-chart__donut-chart">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value}개`, name]} />
            </PieChart>
          </ResponsiveContainer>
          {/* 중앙 라벨 */}
          <div
            className={`analysis-chart__donut-center analysis-chart__donut-center--${safetyLevel}`}
          >
            <span className="analysis-chart__donut-number">{totalDrugs}</span>
            <span className="analysis-chart__donut-text">약물</span>
          </div>
        </div>

        {/* 요약 배지 */}
        <div className="analysis-chart__donut-summary">
          <div
            className={`analysis-chart__donut-status analysis-chart__donut-status--${safetyLevel}`}
          >
            {safetyLevel === "danger" && "🚨"}
            {safetyLevel === "caution" && "⚠️"}
            {safetyLevel === "safe" && "✅"}
            <span>{safetyText}</span>
          </div>
          <div className="analysis-chart__donut-badges">
            {dangerCount > 0 && (
              <span className="analysis-chart__donut-badge analysis-chart__donut-badge--danger">
                위험 {dangerCount}
              </span>
            )}
            {cautionCount > 0 && (
              <span className="analysis-chart__donut-badge analysis-chart__donut-badge--caution">
                주의 {cautionCount}
              </span>
            )}
            {safeCount > 0 && (
              <span className="analysis-chart__donut-badge analysis-chart__donut-badge--safe">
                안전 {safeCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 🆕 영양 균형 도넛 차트 (막대 → 도넛으로 변경)
export const NutritionBalanceDonut = ({ goodPoints, badPoints, warnings }) => {
  const goodCount = goodPoints?.length || 0;
  const badCount = badPoints?.length || 0;
  const warningCount = warnings?.length || 0;

  if (goodCount === 0 && badCount === 0) return null;

  const total = goodCount + badCount + warningCount;
  const positiveRatio = Math.round((goodCount / total) * 100);

  const data = [
    { name: "좋은 점", value: goodCount, color: "#4caf50" },
    { name: "주의 점", value: badCount, color: "#ff9800" },
    { name: "경고", value: warningCount, color: "#f44336" },
  ].filter((item) => item.value > 0);

  const statusLevel =
    positiveRatio >= 70 ? "good" : positiveRatio >= 40 ? "normal" : "bad";
  const statusText =
    positiveRatio >= 70 ? "양호" : positiveRatio >= 40 ? "보통" : "주의";
  const statusIcon =
    positiveRatio >= 70 ? "😊" : positiveRatio >= 40 ? "😐" : "😟";

  return (
    <div className="analysis-chart analysis-chart--balance-donut">
      <h4 className="analysis-chart__title">
        <span className="analysis-chart__icon">⚖️</span>
        분석 결과 요약
      </h4>
      <div className="analysis-chart__balance-container">
        <div className="analysis-chart__balance-chart">
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div
            className={`analysis-chart__balance-center analysis-chart__balance-center--${statusLevel}`}
          >
            <span className="analysis-chart__balance-icon">{statusIcon}</span>
            <span className="analysis-chart__balance-percent">
              {positiveRatio}%
            </span>
          </div>
        </div>

        <div className="analysis-chart__balance-info">
          <div
            className={`analysis-chart__balance-status analysis-chart__balance-status--${statusLevel}`}
          >
            {statusText}
          </div>
          <div className="analysis-chart__balance-legend">
            {goodCount > 0 && (
              <span className="analysis-chart__balance-legend-item analysis-chart__balance-legend-item--good">
                ✅ 좋은 점 {goodCount}개
              </span>
            )}
            {badCount > 0 && (
              <span className="analysis-chart__balance-legend-item analysis-chart__balance-legend-item--bad">
                ⚠️ 주의 점 {badCount}개
              </span>
            )}
            {warningCount > 0 && (
              <span className="analysis-chart__balance-legend-item analysis-chart__balance-legend-item--warning">
                🚨 경고 {warningCount}개
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 🆕 영양소 아이콘 카드 (바 차트 → 아이콘+숫자+설명 형태로 변경)
export const NutritionIconCard = ({ nutrition, servingSize }) => {
  if (!nutrition) return null;

  const { calories, protein, carbs, fat, sodium } = nutrition;

  // 일일 권장량 대비 비율 계산
  const dailyValues = {
    calories: 2000,
    protein: 50,
    carbs: 300,
    fat: 65,
    sodium: 2000,
  };

  const nutritionData = [
    {
      name: "칼로리",
      value: calories,
      max: dailyValues.calories,
      unit: "kcal",
      icon: "🔥",
      description: "에너지원",
    },
    {
      name: "단백질",
      value: protein,
      max: dailyValues.protein,
      unit: "g",
      icon: "💪",
      description: "근육 형성",
    },
    {
      name: "탄수화물",
      value: carbs,
      max: dailyValues.carbs,
      unit: "g",
      icon: "🍚",
      description: "두뇌 활동",
    },
    {
      name: "지방",
      value: fat,
      max: dailyValues.fat,
      unit: "g",
      icon: "🥑",
      description: "필수 지방산",
    },
    {
      name: "나트륨",
      value: sodium,
      max: dailyValues.sodium,
      unit: "mg",
      icon: "🧂",
      description: "체액 균형",
    },
  ];

  // 높음/보통/낮음 레벨 계산
  const getLevel = (value, max) => {
    const percent = (value / max) * 100;
    if (percent > 30) return { level: "high", text: "높음" };
    if (percent > 15) return { level: "normal", text: "적정" };
    return { level: "low", text: "낮음" };
  };

  return (
    <div className="analysis-chart analysis-chart--nutrition-icon">
      <h4 className="analysis-chart__title">
        <span className="analysis-chart__icon">🥗</span>
        영양 성분 정보
        {servingSize && (
          <span className="analysis-chart__subtitle">
            ({servingSize.amount}
            {servingSize.unit} 기준)
          </span>
        )}
      </h4>
      <div className="analysis-chart__nutrition-grid">
        {nutritionData.map((item) => {
          const levelInfo = getLevel(item.value || 0, item.max);
          return (
            <div
              key={item.name}
              className={`analysis-chart__nutrition-card analysis-chart__nutrition-card--${levelInfo.level}`}
            >
              <div className="analysis-chart__nutrition-card-icon">
                {item.icon}
              </div>
              <div className="analysis-chart__nutrition-card-value">
                <span className="analysis-chart__nutrition-card-number">
                  {item.value || 0}
                </span>
                <span className="analysis-chart__nutrition-card-unit">
                  {item.unit}
                </span>
              </div>
              <div className="analysis-chart__nutrition-card-name">
                {item.name}
              </div>
              <div className="analysis-chart__nutrition-card-desc">
                {item.description}
              </div>
              <div
                className={`analysis-chart__nutrition-card-level analysis-chart__nutrition-card-level--${levelInfo.level}`}
              >
                {levelInfo.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 🆕 섭취 타이밍 가이드 (새로 추가)
export const TimingGuideCard = ({ timingGuide, alternatives }) => {
  if (
    (!timingGuide || timingGuide.length === 0) &&
    (!alternatives || alternatives.length === 0)
  ) {
    return null;
  }

  return (
    <div className="analysis-chart analysis-chart--timing">
      <h4 className="analysis-chart__title">
        <span className="analysis-chart__icon">⏰</span>
        섭취 가이드
      </h4>

      <div className="analysis-chart__timing-container">
        {/* 섭취 타이밍 가이드 */}
        {timingGuide && timingGuide.length > 0 && (
          <div className="analysis-chart__timing-section">
            <p className="analysis-chart__timing-section-title">
              💊 약물별 섭취 간격
            </p>
            <div className="analysis-chart__timing-list">
              {timingGuide.map((item, idx) => (
                <div key={idx} className="analysis-chart__timing-item">
                  <div className="analysis-chart__timing-drug">
                    <span className="analysis-chart__timing-drug-name">
                      {item.medication}
                    </span>
                    <span className="analysis-chart__timing-drug-wait">
                      {item.waitHours}시간 간격
                    </span>
                  </div>
                  <p className="analysis-chart__timing-reason">{item.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 대체 음식 추천 */}
        {alternatives && alternatives.length > 0 && (
          <div className="analysis-chart__timing-section">
            <p className="analysis-chart__timing-section-title">
              🔄 대체 음식 추천
            </p>
            <div className="analysis-chart__alternatives-list">
              {alternatives.map((item, idx) => (
                <div key={idx} className="analysis-chart__alternative-item">
                  <span className="analysis-chart__alternative-name">
                    {item.name}
                  </span>
                  <span className="analysis-chart__alternative-reason">
                    {item.reason}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 🆕 적정 섭취량 카드 (새로 추가)
export const ServingSizeCard = ({ servingSize, nutrition }) => {
  if (!servingSize) return null;

  return (
    <div className="analysis-chart analysis-chart--serving">
      <div className="analysis-chart__serving-content">
        <div className="analysis-chart__serving-icon">🍽️</div>
        <div className="analysis-chart__serving-info">
          <span className="analysis-chart__serving-label">1회 적정 섭취량</span>
          <span className="analysis-chart__serving-amount">
            {servingSize.amount}
            {servingSize.unit}
          </span>
          {servingSize.note && (
            <span className="analysis-chart__serving-note">
              {servingSize.note}
            </span>
          )}
        </div>
        {nutrition?.calories && (
          <div className="analysis-chart__serving-calories">
            <span className="analysis-chart__serving-calories-value">
              {nutrition.calories}
            </span>
            <span className="analysis-chart__serving-calories-unit">kcal</span>
          </div>
        )}
      </div>
    </div>
  );
};

// 종합 분석 대시보드 (모든 차트 통합) - 개선 버전
export const AnalysisDashboard = ({ detailedAnalysis }) => {
  if (!detailedAnalysis) return null;

  const hasRiskFactors =
    detailedAnalysis.riskFactors &&
    Object.keys(detailedAnalysis.riskFactors).length > 0;
  const hasInteractions =
    detailedAnalysis.medicalAnalysis?.drug_food_interactions?.length > 0;
  const hasPoints =
    detailedAnalysis.goodPoints?.length > 0 ||
    detailedAnalysis.badPoints?.length > 0;
  const hasNutrition = detailedAnalysis.nutrition;
  const hasServingSize = detailedAnalysis.servingSize;

  // 최소 하나의 차트라도 표시할 데이터가 있어야 렌더링
  if (!hasRiskFactors && !hasInteractions && !hasPoints && !hasNutrition)
    return null;

  return (
    <div className="analysis-dashboard">
      {/* 1. 영양 성분 정보 (가로 스크롤) */}
      {hasNutrition && (
        <NutritionIconCard
          nutrition={detailedAnalysis.nutrition}
          servingSize={detailedAnalysis.servingSize}
        />
      )}

      {/* 2. 차트 영역 (좌우 2열 배치) */}
      {(hasPoints || hasInteractions) && (
        <div className="analysis-dashboard__row">
          {hasPoints && (
            <div className="analysis-dashboard__col">
              <NutritionBalanceDonut
                goodPoints={detailedAnalysis.goodPoints}
                badPoints={detailedAnalysis.badPoints}
                warnings={detailedAnalysis.warnings}
              />
            </div>
          )}

          {hasInteractions && (
            <div className="analysis-dashboard__col">
              <DrugInteractionDonutChart
                interactions={
                  detailedAnalysis.medicalAnalysis.drug_food_interactions
                }
              />
            </div>
          )}
        </div>
      )}

      {/* 3. 위험 성분 분석 (게이지 차트) */}
      {hasRiskFactors && (
        <RiskFactorGaugeChart
          riskFactors={detailedAnalysis.riskFactors}
          riskFactorNotes={detailedAnalysis.riskFactorNotes}
        />
      )}
    </div>
  );
};

export default AnalysisDashboard;
