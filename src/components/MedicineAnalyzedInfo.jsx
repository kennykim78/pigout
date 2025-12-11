import React, { useState } from 'react';
import './MedicineAnalyzedInfo.scss';

/**
 * AI가 분석하고 보완한 약품 정보 카드
 * 공공데이터의 불완전한 정보를 Gemini가 분석하여 보여줌
 */
const MedicineAnalyzedInfo = ({ medicines = [] }) => {
  const [expandedMedicine, setExpandedMedicine] = useState(null);

  if (!medicines || medicines.length === 0) {
    return null;
  }

  // 데이터 완성도 색상 매핑
  const getCompletenessColor = (status) => {
    switch (status) {
      case 'complete':
        return '#51CF66'; // 초록 - 완전한 데이터
      case 'partial':
        return '#FFA100'; // 주황 - 부분 데이터
      case 'ai_enhanced':
        return '#4DA6FF'; // 파랑 - AI 보강 데이터
      default:
        return '#999';
    }
  };

  const getCompletenessLabel = (status) => {
    switch (status) {
      case 'complete':
        return '공개데이터 완전';
      case 'partial':
        return '부분 정보';
      case 'ai_enhanced':
        return 'AI 보강됨';
      default:
        return '정보 없음';
    }
  };

  return (
    <div className="medicine-analyzed-info">
      <div className="medicine-analyzed-header">
        <h3>📊 AI 분석 약품 정보</h3>
        <p className="medicine-analyzed-desc">
          공개데이터와 AI 분석을 통한 통합 약품 정보
        </p>
      </div>

      <div className="medicine-analyzed-list">
        {medicines.map((medicine, idx) => {
          const info = medicine.analyzedInfo;
          const isExpanded = expandedMedicine === idx;

          if (!info) {
            return null;
          }

          return (
            <div key={idx} className="medicine-analyzed-card">
              <div
                className="medicine-analyzed-card-header"
                onClick={() =>
                  setExpandedMedicine(isExpanded ? null : idx)
                }
              >
                <div className="medicine-analyzed-title-section">
                  <h4 className="medicine-analyzed-name">
                    💊 {medicine.name}
                  </h4>
                  {medicine.dosage && (
                    <span className="medicine-analyzed-dosage">
                      {medicine.dosage}
                    </span>
                  )}
                  {medicine.frequency && (
                    <span className="medicine-analyzed-frequency">
                      {medicine.frequency}
                    </span>
                  )}
                </div>

                <div className="medicine-analyzed-badge">
                  <span
                    className="medicine-analyzed-completeness"
                    style={{
                      backgroundColor: getCompletenessColor(
                        info.dataCompleteness
                      ),
                    }}
                  >
                    {getCompletenessLabel(info.dataCompleteness)}
                  </span>
                  <span className="medicine-analyzed-toggle">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="medicine-analyzed-card-body">
                  {/* 효능 */}
                  <div className="medicine-analyzed-section">
                    <h5 className="medicine-analyzed-section-title">
                      ✅ 효능효과
                    </h5>
                    <p className="medicine-analyzed-section-content">
                      {info.efficacy}
                    </p>
                  </div>

                  {/* 용법용량 */}
                  <div className="medicine-analyzed-section">
                    <h5 className="medicine-analyzed-section-title">
                      ⏰ 용법용량
                    </h5>
                    <p className="medicine-analyzed-section-content">
                      {info.usage}
                    </p>
                  </div>

                  {/* 부작용 */}
                  {info.sideEffects && info.sideEffects !== '정보 없음' && (
                    <div className="medicine-analyzed-section">
                      <h5 className="medicine-analyzed-section-title">
                        ⚠️ 부작용/이상반응
                      </h5>
                      <div className="medicine-analyzed-tags">
                        {info.sideEffects.split(',').map((effect, i) => (
                          <span key={i} className="medicine-analyzed-tag">
                            {effect.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 주의사항 */}
                  {info.precautions &&
                    info.precautions !== '정보 없음' && (
                      <div className="medicine-analyzed-section">
                        <h5 className="medicine-analyzed-section-title">
                          🛑 주의사항
                        </h5>
                        <div className="medicine-analyzed-tags">
                          {info.precautions.split(',').map((precaution, i) => (
                            <span
                              key={i}
                              className="medicine-analyzed-tag medicine-analyzed-tag--warning"
                            >
                              {precaution.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* 상호작용 */}
                  {info.interactions &&
                    info.interactions !== '정보 없음' && (
                      <div className="medicine-analyzed-section">
                        <h5 className="medicine-analyzed-section-title">
                          🔗 상호작용
                        </h5>
                        <p className="medicine-analyzed-section-content">
                          {info.interactions}
                        </p>
                      </div>
                    )}

                  {/* 주요 성분 */}
                  {info.components && info.components.length > 0 && (
                    <div className="medicine-analyzed-section">
                      <h5 className="medicine-analyzed-section-title">
                        🧪 주요 성분
                      </h5>
                      <div className="medicine-analyzed-components">
                        {info.components.map((comp, i) => (
                          <div
                            key={i}
                            className="medicine-analyzed-component"
                          >
                            <strong>{comp.name}</strong>
                            <p>{comp.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 보관방법 */}
                  {info.storageMethod &&
                    info.storageMethod !== '정보 없음' && (
                      <div className="medicine-analyzed-section">
                        <h5 className="medicine-analyzed-section-title">
                          📦 보관방법
                        </h5>
                        <p className="medicine-analyzed-section-content">
                          {info.storageMethod}
                        </p>
                      </div>
                    )}

                  {/* 데이터 출처 */}
                  <div className="medicine-analyzed-source">
                    <small>
                      {info.dataCompleteness === 'complete'
                        ? '✓ 공개데이터 기반 정보'
                        : info.dataCompleteness === 'partial'
                        ? '✓ 공개데이터 + AI 보강 정보'
                        : '✓ AI 분석으로 생성된 정보'}
                    </small>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 설명 */}
      <div className="medicine-analyzed-info-box">
        <p>
          <strong>ℹ️ 정보 출처:</strong> 공개데이터(식약처 e약은요)와 AI
          분석을 통합하여 생성된 정보입니다. 정확한 처방은 담당 의사와
          약사에게 상담하세요.
        </p>
      </div>
    </div>
  );
};

export default MedicineAnalyzedInfo;
