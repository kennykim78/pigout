import './MedicineTimingOptimizer.scss';
import { useState } from 'react';

/**
 * 약물 복용 시간 최적화 제안 컴포넌트
 * 
 * 복용 중인 약물들 간의 상호작용을 분석하여
 * 최적의 복용 시간대를 제안합니다
 */
const MedicineTimingOptimizer = ({ medicines = [], interactions = [] }) => {
  const [expandedTiming, setExpandedTiming] = useState(null);

  if (!medicines || medicines.length < 2) {
    return null; // 약물이 1개 이하면 최적화할 필요 없음
  }

  // 시간대별 위험도 분석
  const analyzeTimingRisk = () => {
    const timings = {
      morning: { name: '아침 (6:00-9:00)', medicines: [], riskLevel: 'safe', riskScore: 0 },
      midMorning: { name: '늦은 아침 (9:00-12:00)', medicines: [], riskLevel: 'safe', riskScore: 0 },
      afternoon: { name: '점심 (12:00-14:00)', medicines: [], riskLevel: 'safe', riskScore: 0 },
      midAfternoon: { name: '오후 (14:00-18:00)', medicines: [], riskLevel: 'safe', riskScore: 0 },
      evening: { name: '저녁 (18:00-21:00)', medicines: [], riskLevel: 'safe', riskScore: 0 },
      night: { name: '밤 (21:00-24:00)', medicines: [], riskLevel: 'safe', riskScore: 0 },
    };

    // 각 약물을 시간대에 배치하면서 상호작용 분석
    medicines.forEach(medicine => {
      // 약물별 기본 복용 시간 (API에서 받을 때까지 임시로 분산)
      const medicineIndex = medicines.indexOf(medicine);
      const timingKeys = Object.keys(timings);
      const primaryTiming = timingKeys[medicineIndex % timingKeys.length];
      
      if (!timings[primaryTiming].medicines.includes(medicine.itemName)) {
        timings[primaryTiming].medicines.push(medicine.itemName);
      }
    });

    // 각 시간대의 위험도 계산
    Object.keys(timings).forEach(timingKey => {
      const timing = timings[timingKey];
      const medsInTiming = timing.medicines;

      // 해당 시간대의 모든 약물 조합 위험도 검사
      for (let i = 0; i < medsInTiming.length; i++) {
        for (let j = i + 1; j < medsInTiming.length; j++) {
          const interaction = interactions.find(inter =>
            inter.medicines?.includes(medsInTiming[i]) &&
            inter.medicines?.includes(medsInTiming[j])
          );

          if (interaction) {
            const riskScore = {
              danger: 3,
              caution: 2,
              safe: 1
            }[interaction.risk_level] || 0;

            timing.riskScore += riskScore;
          }
        }
      }

      // 위험도 레벨 결정
      if (timing.riskScore >= 6) {
        timing.riskLevel = 'danger';
      } else if (timing.riskScore >= 3) {
        timing.riskLevel = 'caution';
      } else {
        timing.riskLevel = 'safe';
      }
    });

    return timings;
  };

  const timings = analyzeTimingRisk();
  const bestTiming = Object.values(timings).filter(t => t.medicines.length > 0).sort((a, b) => a.riskScore - b.riskScore)[0];
  const worstTiming = Object.values(timings).filter(t => t.medicines.length > 0).sort((a, b) => b.riskScore - a.riskScore)[0];

  // 최적화 권장사항 생성
  const generateRecommendations = () => {
    const recommendations = [];

    if (worstTiming && worstTiming.riskScore > 0) {
      recommendations.push({
        type: 'warning',
        text: `${worstTiming.name}에는 가능하면 약물을 피하세요. (위험도: ${worstTiming.riskLevel})`
      });
    }

    if (bestTiming && bestTiming.riskScore === 0) {
      recommendations.push({
        type: 'good',
        text: `${bestTiming.name}은(는) 약물 복용에 가장 안전합니다.`
      });
    }

    // 최소 4시간 간격 추천
    recommendations.push({
      type: 'info',
      text: '각 약물 간 최소 4시간의 간격을 유지하세요.'
    });

    // 음식과의 상호작용 고려
    const hasFood = medicines.some(m => m.takeWithFood !== undefined);
    if (hasFood) {
      recommendations.push({
        type: 'info',
        text: '약물에 따라 식사와 함께 또는 공복에 복용하는 것이 권장됩니다.'
      });
    }

    return recommendations;
  };

  const recommendations = generateRecommendations();

  return (
    <div className="medicine-timing-optimizer">
      <div className="medicine-timing-optimizer__header">
        <h3>⏰ 복용 시간 최적화 제안</h3>
        <p className="medicine-timing-optimizer__subtitle">
          {medicines.length}개 약물의 상호작용을 고려한 최적 복용 시간
        </p>
      </div>

      {/* 요약 */}
      <div className="medicine-timing-optimizer__summary">
        <div className="medicine-timing-optimizer__summary-item medicine-timing-optimizer__summary-item--best">
          <span className="medicine-timing-optimizer__summary-label">✅ 최고 (권장)</span>
          <span className="medicine-timing-optimizer__summary-value">{bestTiming?.name}</span>
        </div>
        <div className="medicine-timing-optimizer__summary-item medicine-timing-optimizer__summary-item--worst">
          <span className="medicine-timing-optimizer__summary-label">⚠️ 최악 (피할 것)</span>
          <span className="medicine-timing-optimizer__summary-value">{worstTiming?.name}</span>
        </div>
      </div>

      {/* 시간대별 분석 */}
      <div className="medicine-timing-optimizer__timings">
        {Object.entries(timings)
          .filter(([_, t]) => t.medicines.length > 0)
          .sort(([_a, a], [_b, b]) => a.riskScore - b.riskScore)
          .map(([key, timing]) => (
            <div
              key={key}
              className={`medicine-timing-optimizer__timing medicine-timing-optimizer__timing--${timing.riskLevel}`}
            >
              <button
                className="medicine-timing-optimizer__timing-header"
                onClick={() => setExpandedTiming(expandedTiming === key ? null : key)}
              >
                <div className="medicine-timing-optimizer__timing-info">
                  <span className="medicine-timing-optimizer__timing-icon">
                    {timing.riskLevel === 'danger' && '⛔'}
                    {timing.riskLevel === 'caution' && '⚠️'}
                    {timing.riskLevel === 'safe' && '✅'}
                  </span>
                  <span className="medicine-timing-optimizer__timing-name">{timing.name}</span>
                  <span className="medicine-timing-optimizer__timing-count">
                    {timing.medicines.length}개 약물
                  </span>
                </div>
                <span className={`medicine-timing-optimizer__timing-chevron ${expandedTiming === key ? 'expanded' : ''}`}>
                  ▼
                </span>
              </button>

              {expandedTiming === key && (
                <div className="medicine-timing-optimizer__timing-content">
                  <div className="medicine-timing-optimizer__medicines">
                    {timing.medicines.map((med, idx) => (
                      <div key={idx} className="medicine-timing-optimizer__medicine-item">
                        💊 {med}
                      </div>
                    ))}
                  </div>
                  {timing.riskScore > 0 && (
                    <p className="medicine-timing-optimizer__risk-warning">
                      ⚠️ 위험도 점수: {timing.riskScore} ({timing.riskLevel})
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* 권장사항 */}
      {recommendations.length > 0 && (
        <div className="medicine-timing-optimizer__recommendations">
          <h4 className="medicine-timing-optimizer__recommendations-title">💡 복용 시간 최적화 권장사항</h4>
          <div className="medicine-timing-optimizer__recommendations-list">
            {recommendations.map((rec, idx) => (
              <div key={idx} className={`medicine-timing-optimizer__recommendation medicine-timing-optimizer__recommendation--${rec.type}`}>
                <span className="medicine-timing-optimizer__recommendation-icon">
                  {rec.type === 'warning' && '⚠️'}
                  {rec.type === 'good' && '✅'}
                  {rec.type === 'info' && 'ℹ️'}
                </span>
                <span className="medicine-timing-optimizer__recommendation-text">{rec.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 주의사항 */}
      <div className="medicine-timing-optimizer__caution">
        <p className="medicine-timing-optimizer__caution-title">📌 주의사항</p>
        <ul className="medicine-timing-optimizer__caution-list">
          <li>본 제안은 일반적인 가이드입니다. 처방의약 복용 시간은 의사와 약사의 지시를 따르세요.</li>
          <li>개인차에 따라 최적의 복용 시간이 다를 수 있습니다.</li>
          <li>약물 복용 변경 전에 반드시 의사 또는 약사와 상담하세요.</li>
        </ul>
      </div>
    </div>
  );
};

export default MedicineTimingOptimizer;
