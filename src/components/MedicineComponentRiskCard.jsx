import './MedicineComponentRiskCard.scss';

/**
 * 약물 성분별 위험도 카드 컴포넌트
 * 
 * 약물의 주요 성분과 각 성분이 음식과의 상호작용으로 인한 위험도를 표시
 */
const MedicineComponentRiskCard = ({ medicine = {}, components = [], interactions = [] }) => {
  if (!components || components.length === 0) {
    return (
      <div className="medicine-component-risk">
        <div className="medicine-component-risk__header">
          <h4 className="medicine-component-risk__title">{medicine.name}</h4>
          <span className="medicine-component-risk__badge">성분 정보 없음</span>
        </div>
      </div>
    );
  }

  // 각 성분별 최대 위험도 계산
  const getComponentRisk = (componentName) => {
    const componentInteractions = interactions.filter(i => 
      i.food_components?.includes(componentName) &&
      i.medicines?.includes(medicine.name)
    );

    if (componentInteractions.length === 0) return null;

    // 가장 높은 위험도 찾기
    const riskLevels = componentInteractions.map(i => i.risk_level);
    if (riskLevels.includes('danger')) return 'danger';
    if (riskLevels.includes('caution')) return 'caution';
    if (riskLevels.includes('safe')) return 'safe';
    return null;
  };

  // 성분별 상호작용 정보 가져오기
  const getComponentInteractions = (componentName) => {
    return interactions.filter(i => 
      i.food_components?.includes(componentName) &&
      i.medicines?.includes(medicine.name)
    );
  };

  const componentRisks = components
    .map(comp => ({
      name: comp,
      risk: getComponentRisk(comp),
      interactions: getComponentInteractions(comp)
    }))
    .sort((a, b) => {
      const riskOrder = { danger: 3, caution: 2, safe: 1, null: 0 };
      return (riskOrder[b.risk] || 0) - (riskOrder[a.risk] || 0);
    });

  const hasDanger = componentRisks.some(c => c.risk === 'danger');
  const hasCaution = componentRisks.some(c => c.risk === 'caution');

  return (
    <div className="medicine-component-risk">
      <div className="medicine-component-risk__header">
        <h4 className="medicine-component-risk__title">{medicine.name}</h4>
        <div className="medicine-component-risk__badges">
          {hasDanger && (
            <span className="medicine-component-risk__badge medicine-component-risk__badge--danger">
              위험 성분 포함
            </span>
          )}
          {hasCaution && (
            <span className="medicine-component-risk__badge medicine-component-risk__badge--caution">
              주의 성분 포함
            </span>
          )}
          {!hasDanger && !hasCaution && (
            <span className="medicine-component-risk__badge medicine-component-risk__badge--safe">
              안전
            </span>
          )}
        </div>
      </div>

      <div className="medicine-component-risk__components">
        {componentRisks.map((component, idx) => (
          <div 
            key={idx}
            className={`medicine-component-risk__component medicine-component-risk__component--${component.risk || 'none'}`}
          >
            <div className="medicine-component-risk__component-header">
              <span className="medicine-component-risk__component-icon">
                {component.risk === 'danger' && '⛔'}
                {component.risk === 'caution' && '⚠️'}
                {component.risk === 'safe' && '✅'}
                {!component.risk && '—'}
              </span>
              <span className="medicine-component-risk__component-name">{component.name}</span>
              {component.risk && (
                <span className={`medicine-component-risk__component-risk-label medicine-component-risk__component-risk-label--${component.risk}`}>
                  {component.risk === 'danger' ? '위험' : '주의'}
                </span>
              )}
            </div>

            {component.interactions && component.interactions.length > 0 && (
              <div className="medicine-component-risk__component-details">
                {component.interactions.map((interaction, intIdx) => (
                  <div key={intIdx} className="medicine-component-risk__interaction-item">
                    {interaction.description && (
                      <p className="medicine-component-risk__interaction-desc">
                        {interaction.description}
                      </p>
                    )}
                    {interaction.recommendation && (
                      <p className="medicine-component-risk__interaction-rec">
                        💡 {interaction.recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MedicineComponentRiskCard;
