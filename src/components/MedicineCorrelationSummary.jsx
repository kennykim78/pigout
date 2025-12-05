import { useMemo } from 'react';
import './MedicineCorrelationSummary.scss';

const MedicineCorrelationSummary = ({ medicines = [], aiAnalysis, oneLiner }) => {
  // 🆕 AI 분석 결과 우선 사용
  if (aiAnalysis || oneLiner) {
    console.log('[MedicineCorrelationSummary] AI 분석 데이터 사용:', { aiAnalysis, oneLiner });
    
    return (
      <div className="medicine-correlation-summary">
        {/* AI 한줄평 표시 */}
        {oneLiner && (
          <div className="correlation-alert correlation-alert--ai">
            <span className="alert-icon">🤖</span>
            <span className="alert-text">{oneLiner}</span>
          </div>
        )}
        
        {/* AI 위험 조합 경고 */}
        {aiAnalysis?.hasDanger && aiAnalysis?.dangerMessage && (
          <div className="correlation-alert correlation-alert--danger">
            <span className="alert-icon">🚨</span>
            <span className="alert-text">{aiAnalysis.dangerMessage}</span>
          </div>
        )}

        {/* AI 주의 조합 경고 */}
        {aiAnalysis?.hasCaution && aiAnalysis?.cautionMessage && (
          <div className="correlation-alert correlation-alert--caution">
            <span className="alert-icon">⚠️</span>
            <span className="alert-text">{aiAnalysis.cautionMessage}</span>
          </div>
        )}

        {/* 안전 메시지 (위험/주의 없을 때) */}
        {!aiAnalysis?.hasDanger && !aiAnalysis?.hasCaution && aiAnalysis?.safeMessage && (
          <div className="correlation-alert correlation-alert--safe">
            <span className="alert-icon">✅</span>
            <span className="alert-text">{aiAnalysis.safeMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // ⚠️ AI 분석 없으면 하드코딩 로직 사용 (폴백)
  console.log('[MedicineCorrelationSummary] AI 분석 없음, 하드코딩 로직 사용');
  
  // 상호작용 분석 결과 계산
  const correlationSummary = useMemo(() => {
    if (!medicines || medicines.length < 2) {
      return null;
    }

    // 위험한 조합 목록 (예시)
    const dangerousPairs = [
      { drug1: '아세트아미노펜', drug2: '이부프로펜' },
      { drug1: '와르파린', drug2: '아스피린' },
      { drug1: '메토프롤롤', drug2: '베라파밀' },
    ];

    // 주의가 필요한 조합 목록 (예시)
    const cautionPairs = [
      { drug1: '카페인', drug2: '알코올' },
      { drug1: '비타민K', drug2: '항응고제' },
    ];

    // 약품명 추출 (itemName 또는 name, 둘 다 지원)
    const medicineNames = medicines.map(m => (m.itemName || m.name || '')).filter(Boolean);

    // 위험한 조합 찾기
    let hasDangerousCombination = false;
    let dangerousCombo = null;
    for (const pair of dangerousPairs) {
      const has1 = medicineNames.some(name => name.includes(pair.drug1));
      const has2 = medicineNames.some(name => name.includes(pair.drug2));
      if (has1 && has2) {
        hasDangerousCombination = true;
        dangerousCombo = `${pair.drug1}과 ${pair.drug2}`;
        break;
      }
    }

    // 주의가 필요한 조합 찾기
    let hasCautionCombination = false;
    let cautionCombo = null;
    for (const pair of cautionPairs) {
      const has1 = medicineNames.some(name => name.includes(pair.drug1));
      const has2 = medicineNames.some(name => name.includes(pair.drug2));
      if (has1 && has2) {
        hasCautionCombination = true;
        cautionCombo = `${pair.drug1}과 ${pair.drug2}`;
        break;
      }
    }

    return {
      hasDangerousCombination,
      dangerousCombo,
      hasCautionCombination,
      cautionCombo,
      totalMedicines: medicines.length,
    };
  }, [medicines]);

  // 최소 2개 이상의 약품이 없으면 표시 안 함
  if (!correlationSummary) {
    return null;
  }

  const { hasDangerousCombination, dangerousCombo, hasCautionCombination, cautionCombo, totalMedicines } = correlationSummary;

  // 위험 또는 주의 조합이 없으면 안전 메시지 표시
  if (!hasDangerousCombination && !hasCautionCombination && totalMedicines >= 2) {
    return (
      <div className="medicine-correlation-summary">
        <div className="correlation-alert correlation-alert--safe">
          <span className="alert-icon">✅</span>
          <span className="alert-text">
            현재 <strong>{totalMedicines}개 약품</strong>은 안전한 조합입니다
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="medicine-correlation-summary">
      {hasDangerousCombination && (
        <div className="correlation-alert correlation-alert--danger">
          <span className="alert-icon">🚨</span>
          <span className="alert-text">
            <strong>{dangerousCombo}</strong> 상호작용 주의 필요
          </span>
        </div>
      )}

      {hasCautionCombination && (
        <div className="correlation-alert correlation-alert--caution">
          <span className="alert-icon">⚠️</span>
          <span className="alert-text">
            <strong>{cautionCombo}</strong> 복용 시 유의
          </span>
        </div>
      )}
    </div>
  );
};

export default MedicineCorrelationSummary;
