import { useState } from 'react';
import './MedicineDetailPopup.scss';

const MedicineDetailPopup = ({ medicine, onClose }) => {
  if (!medicine) return null;

  // 🧠 qr_code_data에서 AI 분석 정보 추출
  let parsedData = {};
  let aiInfo = null;
  try {
    if (medicine.qr_code_data) {
      parsedData = typeof medicine.qr_code_data === 'string' 
        ? JSON.parse(medicine.qr_code_data) 
        : medicine.qr_code_data;
      aiInfo = parsedData.aiAnalyzedInfo;
    }
  } catch (e) {
    console.warn('[MedicineDetailPopup] qr_code_data 파싱 실패:', e);
  }

  const {
    itemName = '',
    entpName = '',
    itemSeq = '',
    efcyQesitm = '',
    useMethodQesitm = '',
    atpnWarnQesitm = '',
    intrcQesitm = '',
    seQesitm = '',
    depositMethodQesitm = '',
    // DB에서 저장된 필드명 지원
    name = itemName,
    dosage = useMethodQesitm,
    frequency = '',
  } = medicine;

  // 🆕 공공데이터 우선, 없으면 parsedData, 최종적으로 AI 정보 사용
  const displayEfficacy = efcyQesitm || parsedData.efcyQesitm || aiInfo?.efficacy || '';
  const displayUsage = useMethodQesitm || parsedData.useMethodQesitm || dosage || aiInfo?.usage || '';
  const displayPrecautions = atpnWarnQesitm || parsedData.atpnWarnQesitm || aiInfo?.precautions || '';
  const displayInteractions = intrcQesitm || parsedData.intrcQesitm || aiInfo?.interactions || '';
  const displaySideEffects = seQesitm || parsedData.seQesitm || aiInfo?.sideEffects || '';
  const displayStorage = depositMethodQesitm || parsedData.depositMethodQesitm || aiInfo?.storageMethod || '';
  
  // 데이터 완성도 표시
  const dataSource = aiInfo?.dataCompleteness === 'complete' ? '공공데이터' :
                     aiInfo?.dataCompleteness === 'partial' ? '공공데이터 + AI 보완' :
                     aiInfo?.dataCompleteness === 'ai_enhanced' ? 'AI 분석' : null;

  return (
    <div className="medicine-detail-popup-overlay" onClick={onClose}>
      <div className="medicine-detail-popup" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="medicine-detail-header">
          <div>
            <h2 className="medicine-detail-title">{itemName || name || '약품명 미확인'}</h2>
            <p className="medicine-detail-company">{entpName || '제조사 미확인'}</p>
          </div>
          <button className="medicine-detail-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 바디 - 스크롤 영역 */}
        <div className="medicine-detail-body">
          {/* 🆕 데이터 출처 표시 */}
          {dataSource && (
            <div className="medicine-detail-section medicine-detail-section--info">
              <div className="section-content">
                <div className="info-row">
                  <span className="info-label">📊 정보 출처</span>
                  <span className="info-value">{dataSource}</span>
                </div>
              </div>
            </div>
          )}

          {/* 효능 */}
          {displayEfficacy && (
            <div className="medicine-detail-section highlight">
              <h3 className="section-title">💊 효능·효과</h3>
              <div className="section-content">
                <p className="medicine-text">{displayEfficacy}</p>
              </div>
            </div>
          )}

          {/* 용법 */}
          {(displayUsage || frequency) && (
            <div className="medicine-detail-section highlight">
              <h3 className="section-title">📋 용법·용량</h3>
              <div className="section-content">
                <p className="medicine-text">{displayUsage || frequency || '기본 용법'}</p>
              </div>
            </div>
          )}

          {/* 주의사항 */}
          {displayPrecautions && (
            <div className="medicine-detail-section">
              <h3 className="section-title">⚠️ 주의사항</h3>
              <div className="section-content">
                <p className="medicine-text warning-text">{displayPrecautions}</p>
              </div>
            </div>
          )}

          {/* 상호작용 */}
          {displayInteractions && (
            <div className="medicine-detail-section">
              <h3 className="section-title">🔗 상호작용</h3>
              <div className="section-content">
                <p className="medicine-text">{displayInteractions}</p>
              </div>
            </div>
          )}

          {/* 부작용 */}
          {displaySideEffects && (
            <div className="medicine-detail-section">
              <h3 className="section-title">🚨 부작용</h3>
              <div className="section-content">
                <p className="medicine-text">{displaySideEffects}</p>
              </div>
            </div>
          )}

          {/* 보관 방법 */}
          {displayStorage && (
            <div className="medicine-detail-section">
              <h3 className="section-title">🏠 보관 방법</h3>
              <div className="section-content">
                <p className="medicine-text">{displayStorage}</p>
              </div>
            </div>
          )}

          {/* 정보가 없을 경우 */}
          {!displayEfficacy && !displayUsage && !displayPrecautions && !displayInteractions && !displaySideEffects && !displayStorage && (
            <div className="medicine-detail-empty">
              <p>📄 상세 정보가 없습니다.</p>
              <p className="empty-hint">약품을 다시 등록하시면 AI가 정보를 보완합니다.</p>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="medicine-detail-footer">
          <button className="medicine-detail-close-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default MedicineDetailPopup;
