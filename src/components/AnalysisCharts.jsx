import { useState, useEffect } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import './AnalysisCharts.scss';

// 위험 성분 레이더 차트
export const RiskFactorRadarChart = ({ riskFactors, riskFactorNotes }) => {
  if (!riskFactors || Object.keys(riskFactors).length === 0) return null;

  const riskLabels = {
    alcohol: '알코올',
    highSodium: '나트륨',
    highPotassium: '칼륨',
    caffeine: '카페인',
    citrus: '감귤류',
    grapefruit: '자몽',
    dairy: '유제품',
    highFat: '지방',
    vitaminK: '비타민K',
    tyramine: '티라민',
    highSugar: '당류',
    highCholesterol: '콜레스테롤',
  };

  // 데이터 변환: true/false를 수치로 변환 (검출=100, 안전=20)
  const chartData = Object.entries(riskFactors)
    .filter(([key]) => riskLabels[key])
    .map(([key, value]) => ({
      factor: riskLabels[key] || key,
      value: value ? 100 : 20,
      fullMark: 100,
      detected: value,
    }));

  if (chartData.length < 3) return null; // 최소 3개 이상 필요

  return (
    <div className="analysis-chart analysis-chart--radar">
      <h4 className="analysis-chart__title">
        <span className="analysis-chart__icon">🔬</span>
        위험 성분 분석
      </h4>
      <div className="analysis-chart__container">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid stroke="#e0e0e0" />
            <PolarAngleAxis 
              dataKey="factor" 
              tick={{ fill: '#666', fontSize: 11 }}
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 100]} 
              tick={false}
              axisLine={false}
            />
            <Radar
              name="위험도"
              dataKey="value"
              stroke="#ff6b6b"
              fill="#ff6b6b"
              fillOpacity={0.4}
              strokeWidth={2}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="analysis-chart__tooltip">
                      <p className="analysis-chart__tooltip-label">{data.factor}</p>
                      <p className={`analysis-chart__tooltip-value ${data.detected ? 'detected' : 'safe'}`}>
                        {data.detected ? '⚠️ 검출됨' : '✅ 안전'}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="analysis-chart__legend">
        <span className="analysis-chart__legend-item analysis-chart__legend-item--danger">
          ⚠️ 주의 성분
        </span>
        <span className="analysis-chart__legend-item analysis-chart__legend-item--safe">
          ✅ 안전 성분
        </span>
      </div>
    </div>
  );
};

// 약물 상호작용 파이 차트
export const DrugInteractionPieChart = ({ interactions }) => {
  if (!interactions || interactions.length === 0) return null;

  const dangerCount = interactions.filter(d => d.risk_level === 'danger').length;
  const cautionCount = interactions.filter(d => d.risk_level === 'caution').length;
  const safeCount = interactions.filter(d => d.risk_level === 'safe').length;

  const data = [
    { name: '위험', value: dangerCount, color: '#ef5350' },
    { name: '주의', value: cautionCount, color: '#ffa726' },
    { name: '안전', value: safeCount, color: '#66bb6a' },
  ].filter(item => item.value > 0);

  if (data.length === 0) return null;

  const totalDrugs = interactions.length;

  return (
    <div className="analysis-chart analysis-chart--pie">
      <h4 className="analysis-chart__title">
        <span className="analysis-chart__icon">💊</span>
        약물 상호작용 현황
      </h4>
      <div className="analysis-chart__container">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              label={({ name, value }) => `${name} ${value}개`}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value, name) => [`${value}개 약물`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="analysis-chart__center-label">
          <span className="analysis-chart__center-number">{totalDrugs}</span>
          <span className="analysis-chart__center-text">약물 분석</span>
        </div>
      </div>
      <div className="analysis-chart__summary">
        {dangerCount > 0 && (
          <span className="analysis-chart__badge analysis-chart__badge--danger">
            🚨 위험 {dangerCount}개
          </span>
        )}
        {cautionCount > 0 && (
          <span className="analysis-chart__badge analysis-chart__badge--caution">
            ⚠️ 주의 {cautionCount}개
          </span>
        )}
        {safeCount > 0 && (
          <span className="analysis-chart__badge analysis-chart__badge--safe">
            ✅ 안전 {safeCount}개
          </span>
        )}
      </div>
    </div>
  );
};

// 영양 균형 차트 (좋은점/나쁜점 비율)
export const NutritionBalanceChart = ({ goodPoints, badPoints, warnings }) => {
  const goodCount = goodPoints?.length || 0;
  const badCount = badPoints?.length || 0;
  const warningCount = warnings?.length || 0;

  if (goodCount === 0 && badCount === 0) return null;

  const data = [
    { name: '좋은 점', value: goodCount, fill: '#4caf50' },
    { name: '주의 점', value: badCount, fill: '#ff9800' },
    { name: '경고', value: warningCount, fill: '#f44336' },
  ].filter(item => item.value > 0);

  const total = goodCount + badCount + warningCount;
  const healthScore = Math.round((goodCount / total) * 100);

  return (
    <div className="analysis-chart analysis-chart--balance">
      <h4 className="analysis-chart__title">
        <span className="analysis-chart__icon">⚖️</span>
        분석 결과 요약
      </h4>
      <div className="analysis-chart__container">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, Math.max(...data.map(d => d.value)) + 1]} />
            <YAxis type="category" dataKey="name" width={60} />
            <Tooltip formatter={(value) => [`${value}개`, '항목 수']} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="analysis-chart__health-score">
        <div className="analysis-chart__score-bar">
          <div 
            className="analysis-chart__score-fill"
            style={{ width: `${healthScore}%` }}
          />
        </div>
        <span className="analysis-chart__score-text">
          긍정 비율 <strong>{healthScore}%</strong>
        </span>
      </div>
    </div>
  );
};

// 종합 분석 대시보드 (모든 차트 통합)
export const AnalysisDashboard = ({ detailedAnalysis }) => {
  if (!detailedAnalysis) return null;

  const hasRiskFactors = detailedAnalysis.riskFactors && 
    Object.keys(detailedAnalysis.riskFactors).length > 0;
  const hasInteractions = detailedAnalysis.medicalAnalysis?.drug_food_interactions?.length > 0;
  const hasPoints = (detailedAnalysis.goodPoints?.length > 0) || 
    (detailedAnalysis.badPoints?.length > 0);

  // 최소 하나의 차트라도 표시할 데이터가 있어야 렌더링
  if (!hasRiskFactors && !hasInteractions && !hasPoints) return null;

  return (
    <div className="analysis-dashboard">
      <h3 className="analysis-dashboard__title">
        <span className="analysis-dashboard__icon">📊</span>
        시각적 분석
      </h3>
      
      <div className="analysis-dashboard__charts">
        {/* 영양 균형 차트 (항상 상단에 표시) */}
        {hasPoints && (
          <NutritionBalanceChart 
            goodPoints={detailedAnalysis.goodPoints}
            badPoints={detailedAnalysis.badPoints}
            warnings={detailedAnalysis.warnings}
          />
        )}

        {/* 약물 상호작용 차트 */}
        {hasInteractions && (
          <DrugInteractionPieChart 
            interactions={detailedAnalysis.medicalAnalysis.drug_food_interactions}
          />
        )}

        {/* 위험 성분 레이더 차트 */}
        {hasRiskFactors && (
          <RiskFactorRadarChart 
            riskFactors={detailedAnalysis.riskFactors}
            riskFactorNotes={detailedAnalysis.riskFactorNotes}
          />
        )}
      </div>
    </div>
  );
};

export default AnalysisDashboard;
