import './FoodDrugInteractionMatrix.scss';

/**
 * 음식-약물 상호작용 맵 컴포넌트
 * 
 * 약물과 음식 성분 간의 상호작용을 Matrix 형태로 시각화
 * - X축: 음식 성분
 * - Y축: 복용 중인 약물
 * - 셀: 상호작용 정보 및 위험도
 */
const FoodDrugInteractionMatrix = ({ interactions = [], foodComponents = [], medicines = [] }) => {
  if (!interactions || interactions.length === 0) {
    return (
      <div className="food-drug-matrix">
        <div className="food-drug-matrix__header">
          <h3>📋 음식-약물 상호작용 맵</h3>
          <p className="food-drug-matrix__subtitle">약물과 음식 성분 간의 상호작용을 시각화합니다</p>
        </div>
        <div className="food-drug-matrix__empty">
          상호작용 데이터가 없습니다
        </div>
      </div>
    );
  }

  // 약물 목록 추출 (중복 제거)
  const uniqueMedicines = [...new Set(interactions
    .map(i => i.medicine_name)
    .filter(m => m))];

  // 음식 성분 목록 추출 (중복 제거)
  const uniqueFoodComponents = [...new Set(interactions
    .flatMap(i => i.food_components || i.matched_components || [])
    .filter(f => f))];

  // 상호작용 검색 함수
  const findInteraction = (medicineName, componentName) => {
    return interactions.find(i => 
      i.medicine_name === medicineName && 
      (i.food_components || i.matched_components || []).includes(componentName)
    );
  };

  // 위험도 점수 계산
  const getRiskScore = (riskLevel) => {
    switch(riskLevel) {
      case 'danger': return 3;
      case 'caution': return 2;
      case 'safe': return 1;
      default: return 0;
    }
  };

  // 위험도별 색상 클래스
  const getRiskClass = (riskLevel) => {
    switch(riskLevel) {
      case 'danger': return 'danger';
      case 'caution': return 'caution';
      case 'safe': return 'safe';
      default: return 'none';
    }
  };

  return (
    <div className="food-drug-matrix">
      <div className="food-drug-matrix__header">
        <h3>📋 음식-약물 상호작용 맵</h3>
        <p className="food-drug-matrix__subtitle">
          약물({uniqueMedicines.length}) × 성분({uniqueFoodComponents.length}) = 
          총 {uniqueMedicines.length * uniqueFoodComponents.length}가지 조합
        </p>
      </div>

      {/* 범례 */}
      <div className="food-drug-matrix__legend">
        <div className="food-drug-matrix__legend-item">
          <span className="food-drug-matrix__legend-color food-drug-matrix__legend-color--danger"></span>
          <span className="food-drug-matrix__legend-label">위험 (복용 금지)</span>
        </div>
        <div className="food-drug-matrix__legend-item">
          <span className="food-drug-matrix__legend-color food-drug-matrix__legend-color--caution"></span>
          <span className="food-drug-matrix__legend-label">주의 (의사 상담)</span>
        </div>
        <div className="food-drug-matrix__legend-item">
          <span className="food-drug-matrix__legend-color food-drug-matrix__legend-color--safe"></span>
          <span className="food-drug-matrix__legend-label">안전 (문제없음)</span>
        </div>
        <div className="food-drug-matrix__legend-item">
          <span className="food-drug-matrix__legend-color food-drug-matrix__legend-color--none"></span>
          <span className="food-drug-matrix__legend-label">정보없음</span>
        </div>
      </div>

      {/* Matrix 테이블 */}
      <div className="food-drug-matrix__scroll-container">
        <table className="food-drug-matrix__table">
          <thead>
            <tr>
              <th className="food-drug-matrix__corner-cell">약물 / 성분</th>
              {uniqueFoodComponents.map((component, idx) => (
                <th key={idx} className="food-drug-matrix__header-cell">
                  <div className="food-drug-matrix__header-text">{component}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uniqueMedicines.map((medicine, medIdx) => (
              <tr key={medIdx}>
                <td className="food-drug-matrix__row-header">
                  <div className="food-drug-matrix__row-header-content">{medicine}</div>
                </td>
                {uniqueFoodComponents.map((component, compIdx) => {
                  const interaction = findInteraction(medicine, component);
                  const riskLevel = interaction?.risk_level || 'none';
                  const riskClass = getRiskClass(riskLevel);
                  
                  return (
                    <td 
                      key={compIdx}
                      className={`food-drug-matrix__cell food-drug-matrix__cell--${riskClass}`}
                      title={interaction?.description || '상호작용 정보 없음'}
                    >
                      <div className="food-drug-matrix__cell-content">
                        {riskLevel === 'danger' && '⛔'}
                        {riskLevel === 'caution' && '⚠️'}
                        {riskLevel === 'safe' && '✅'}
                        {riskLevel === 'none' && '—'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 상세 정보 섹션 */}
      {interactions.some(i => i.risk_level === 'danger' || i.risk_level === 'caution') && (
        <div className="food-drug-matrix__details">
          <h4 className="food-drug-matrix__details-title">⚠️ 주의가 필요한 조합</h4>
          <div className="food-drug-matrix__details-list">
            {interactions
              .filter(i => i.risk_level === 'danger' || i.risk_level === 'caution')
              .map((interaction, idx) => (
                <div key={idx} className={`food-drug-matrix__detail-item food-drug-matrix__detail-item--${interaction.risk_level}`}>
                  <div className="food-drug-matrix__detail-header">
                    <span className="food-drug-matrix__detail-icon">
                      {interaction.risk_level === 'danger' ? '⛔' : '⚠️'}
                    </span>
                    <span className="food-drug-matrix__detail-medicines">
                      {Array.isArray(interaction.medicines) 
                        ? interaction.medicines.join(', ') 
                        : interaction.medicines}
                    </span>
                    <span className="food-drug-matrix__detail-separator">+</span>
                    <span className="food-drug-matrix__detail-components">
                      {Array.isArray(interaction.food_components) 
                        ? interaction.food_components.join(', ') 
                        : interaction.food_components}
                    </span>
                  </div>
                  {interaction.description && (
                    <p className="food-drug-matrix__detail-description">
                      {interaction.description}
                    </p>
                  )}
                  {interaction.recommendation && (
                    <p className="food-drug-matrix__detail-recommendation">
                      💡 {interaction.recommendation}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 사용 방법 */}
      <div className="food-drug-matrix__guide">
        <p className="food-drug-matrix__guide-title">📌 사용 방법</p>
        <ul className="food-drug-matrix__guide-list">
          <li>행(세로): 복용 중인 약물</li>
          <li>열(가로): 음식에 포함된 성분</li>
          <li>교차점: 약물과 성분 간의 상호작용</li>
          <li>⛔ = 위험 (복용 금지), ⚠️ = 주의 (의사 상담), ✅ = 안전 (문제없음)</li>
        </ul>
      </div>
    </div>
  );
};

export default FoodDrugInteractionMatrix;
