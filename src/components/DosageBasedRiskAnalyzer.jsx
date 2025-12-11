import './DosageBasedRiskAnalyzer.scss';

/**
 * 용량 기반 위험도 차등화 컴포넌트
 * 
 * 약물의 복용량에 따라 상호작용 위험도를 차등화하여 표시
 * - 고용량: 위험도 증가
 * - 저용량: 위험도 감소
 * - 표준용량: 기본 위험도
 */
const DosageBasedRiskAnalyzer = ({ medicines = [], interactions = [] }) => {
  if (!medicines || medicines.length === 0) {
    return null;
  }

  // 용량 단위 정규화 (mg 기준)
  const normalizeDosage = (dosage) => {
    if (!dosage) return null;
    
    const dosageStr = String(dosage).toLowerCase();
    
    // mg 추출
    const mgMatch = dosageStr.match(/(\d+(?:\.\d+)?)\s*mg/);
    if (mgMatch) {
      return parseFloat(mgMatch[1]);
    }
    
    // g 추출 (g -> mg 변환)
    const gMatch = dosageStr.match(/(\d+(?:\.\d+)?)\s*g/);
    if (gMatch) {
      return parseFloat(gMatch[1]) * 1000;
    }
    
    // μg 추출 (μg -> mg 변환)
    const ugMatch = dosageStr.match(/(\d+(?:\.\d+)?)\s*[μu]g/);
    if (ugMatch) {
      return parseFloat(ugMatch[1]) / 1000;
    }
    
    return null;
  };

  // 용량 등급 계산 (저/표준/고)
  const getDosageLevel = (medicine) => {
    const dosage = normalizeDosage(medicine.dosage || medicine.efcyQesitm);
    
    if (!dosage) return 'unknown';
    
    // 일반적인 용량 기준 (약물별로 다를 수 있음)
    // 실제로는 백엔드 API에서 약물별 표준용량을 가져와야 함
    if (dosage < 50) return 'low';
    if (dosage <= 500) return 'standard';
    return 'high';
  };

  // 용량 기반 위험도 계수 계산
  const getDosageRiskMultiplier = (dosageLevel) => {
    switch(dosageLevel) {
      case 'low': return 0.7; // 저용량은 위험도 30% 감소
      case 'standard': return 1.0; // 표준용량은 기본
      case 'high': return 1.5; // 고용량은 위험도 50% 증가
      default: return 1.0;
    }
  };

  // 용량별 위험도 분석
  const analyzeDosageRisks = () => {
    return medicines.map(medicine => {
      const dosageLevel = getDosageLevel(medicine);
      const dosage = normalizeDosage(medicine.dosage || medicine.efcyQesitm);
      const multiplier = getDosageRiskMultiplier(dosageLevel);

      // 해당 약물과 관련된 상호작용 찾기
      const relatedInteractions = interactions.filter(i => 
        i.medicines?.includes(medicine.itemName || medicine.name)
      );

      // 기본 위험도 점수 계산
      let baseRiskScore = 0;
      relatedInteractions.forEach(interaction => {
        if (interaction.risk_level === 'danger') baseRiskScore += 3;
        else if (interaction.risk_level === 'caution') baseRiskScore += 2;
        else if (interaction.risk_level === 'safe') baseRiskScore += 1;
      });

      // 용량 기반 조정된 위험도
      const adjustedRiskScore = baseRiskScore * multiplier;

      // 최종 위험도 레벨 결정
      let finalRiskLevel = 'safe';
      if (adjustedRiskScore >= 6) finalRiskLevel = 'danger';
      else if (adjustedRiskScore >= 3) finalRiskLevel = 'caution';

      return {
        medicine,
        dosage,
        dosageLevel,
        multiplier,
        baseRiskScore,
        adjustedRiskScore,
        finalRiskLevel,
        relatedInteractions
      };
    }).sort((a, b) => b.adjustedRiskScore - a.adjustedRiskScore);
  };

  const dosageRisks = analyzeDosageRisks();
  const hasHighRisk = dosageRisks.some(r => r.finalRiskLevel === 'danger');
  const hasCautionRisk = dosageRisks.some(r => r.finalRiskLevel === 'caution');

  return (
    <div className="dosage-risk-analyzer">
      <div className="dosage-risk-analyzer__header">
        <h3>💊 용량 기반 위험도 분석</h3>
        <p className="dosage-risk-analyzer__subtitle">
          복용량에 따라 상호작용 위험도가 달라집니다
        </p>
      </div>

      {/* 전체 요약 */}
      <div className="dosage-risk-analyzer__summary">
        <div className="dosage-risk-analyzer__summary-stats">
          <div className="dosage-risk-analyzer__stat">
            <span className="dosage-risk-analyzer__stat-label">총 약물</span>
            <span className="dosage-risk-analyzer__stat-value">{dosageRisks.length}개</span>
          </div>
          <div className="dosage-risk-analyzer__stat">
            <span className="dosage-risk-analyzer__stat-label">고위험</span>
            <span className="dosage-risk-analyzer__stat-value dosage-risk-analyzer__stat-value--danger">
              {dosageRisks.filter(r => r.finalRiskLevel === 'danger').length}개
            </span>
          </div>
          <div className="dosage-risk-analyzer__stat">
            <span className="dosage-risk-analyzer__stat-label">주의</span>
            <span className="dosage-risk-analyzer__stat-value dosage-risk-analyzer__stat-value--caution">
              {dosageRisks.filter(r => r.finalRiskLevel === 'caution').length}개
            </span>
          </div>
        </div>

        {(hasHighRisk || hasCautionRisk) && (
          <div className="dosage-risk-analyzer__alert">
            {hasHighRisk && (
              <p className="dosage-risk-analyzer__alert-text dosage-risk-analyzer__alert-text--danger">
                ⛔ 고용량 위험 약물이 있습니다. 의사와 상담하세요.
              </p>
            )}
            {hasCautionRisk && !hasHighRisk && (
              <p className="dosage-risk-analyzer__alert-text dosage-risk-analyzer__alert-text--caution">
                ⚠️ 주의가 필요한 약물이 있습니다.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 약물별 용량 분석 */}
      <div className="dosage-risk-analyzer__medicines">
        {dosageRisks.map((risk, idx) => (
          <div 
            key={idx}
            className={`dosage-risk-analyzer__medicine dosage-risk-analyzer__medicine--${risk.finalRiskLevel}`}
          >
            <div className="dosage-risk-analyzer__medicine-header">
              <div className="dosage-risk-analyzer__medicine-info">
                <h4 className="dosage-risk-analyzer__medicine-name">
                  {risk.medicine.itemName || risk.medicine.name}
                </h4>
                <span className={`dosage-risk-analyzer__dosage-badge dosage-risk-analyzer__dosage-badge--${risk.dosageLevel}`}>
                  {risk.dosageLevel === 'low' && '저용량'}
                  {risk.dosageLevel === 'standard' && '표준'}
                  {risk.dosageLevel === 'high' && '고용량'}
                  {risk.dosageLevel === 'unknown' && '정보없음'}
                </span>
              </div>
              <span className={`dosage-risk-analyzer__risk-badge dosage-risk-analyzer__risk-badge--${risk.finalRiskLevel}`}>
                {risk.finalRiskLevel === 'danger' && '⛔ 위험'}
                {risk.finalRiskLevel === 'caution' && '⚠️ 주의'}
                {risk.finalRiskLevel === 'safe' && '✅ 안전'}
              </span>
            </div>

            <div className="dosage-risk-analyzer__medicine-details">
              {risk.dosage && (
                <div className="dosage-risk-analyzer__detail-row">
                  <span className="dosage-risk-analyzer__detail-label">복용량:</span>
                  <span className="dosage-risk-analyzer__detail-value">{risk.dosage.toFixed(2)} mg</span>
                </div>
              )}

              <div className="dosage-risk-analyzer__detail-row">
                <span className="dosage-risk-analyzer__detail-label">기본 위험도:</span>
                <span className="dosage-risk-analyzer__detail-value">{risk.baseRiskScore.toFixed(1)}</span>
              </div>

              <div className="dosage-risk-analyzer__detail-row">
                <span className="dosage-risk-analyzer__detail-label">용량 계수:</span>
                <span className="dosage-risk-analyzer__detail-value">×{risk.multiplier}</span>
              </div>

              <div className="dosage-risk-analyzer__detail-row dosage-risk-analyzer__detail-row--highlight">
                <span className="dosage-risk-analyzer__detail-label">조정 위험도:</span>
                <span className={`dosage-risk-analyzer__detail-value dosage-risk-analyzer__detail-value--${risk.finalRiskLevel}`}>
                  {risk.adjustedRiskScore.toFixed(1)}
                </span>
              </div>
            </div>

            {risk.relatedInteractions.length > 0 && (
              <div className="dosage-risk-analyzer__interactions">
                <p className="dosage-risk-analyzer__interactions-title">
                  관련 상호작용 ({risk.relatedInteractions.length}개):
                </p>
                <ul className="dosage-risk-analyzer__interactions-list">
                  {risk.relatedInteractions.slice(0, 3).map((interaction, intIdx) => (
                    <li key={intIdx} className="dosage-risk-analyzer__interaction-item">
                      <span className={`dosage-risk-analyzer__interaction-icon dosage-risk-analyzer__interaction-icon--${interaction.risk_level}`}>
                        {interaction.risk_level === 'danger' ? '⛔' : interaction.risk_level === 'caution' ? '⚠️' : '✅'}
                      </span>
                      <span className="dosage-risk-analyzer__interaction-text">
                        {interaction.description?.substring(0, 80)}...
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 안내 사항 */}
      <div className="dosage-risk-analyzer__guide">
        <h4 className="dosage-risk-analyzer__guide-title">📋 용량별 위험도 이해하기</h4>
        <div className="dosage-risk-analyzer__guide-content">
          <div className="dosage-risk-analyzer__guide-item">
            <span className="dosage-risk-analyzer__guide-label">저용량 (×0.7):</span>
            <span className="dosage-risk-analyzer__guide-text">위험도 30% 감소, 부작용 가능성 낮음</span>
          </div>
          <div className="dosage-risk-analyzer__guide-item">
            <span className="dosage-risk-analyzer__guide-label">표준용량 (×1.0):</span>
            <span className="dosage-risk-analyzer__guide-text">일반적인 위험도, 권장 복용량</span>
          </div>
          <div className="dosage-risk-analyzer__guide-item">
            <span className="dosage-risk-analyzer__guide-label">고용량 (×1.5):</span>
            <span className="dosage-risk-analyzer__guide-text">위험도 50% 증가, 주의 필요</span>
          </div>
        </div>
      </div>

      {/* 주의사항 */}
      <div className="dosage-risk-analyzer__caution">
        <p className="dosage-risk-analyzer__caution-title">⚠️ 중요 안내</p>
        <ul className="dosage-risk-analyzer__caution-list">
          <li>본 분석은 참고용입니다. 정확한 진단은 의사와 상담하세요.</li>
          <li>복용량 조절은 반드시 의사의 지시에 따라야 합니다.</li>
          <li>자의적인 용량 변경은 위험할 수 있습니다.</li>
        </ul>
      </div>
    </div>
  );
};

export default DosageBasedRiskAnalyzer;
