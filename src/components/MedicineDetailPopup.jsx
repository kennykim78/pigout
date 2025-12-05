import { useState } from 'react';
import './MedicineDetailPopup.scss';

const MedicineDetailPopup = ({ medicine, onClose }) => {
  if (!medicine) return null;

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
    qr_code_data = '',
  } = medicine;

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
          {/* 기본 정보 */}
          {itemSeq && (
            <div className="medicine-detail-section">
              <h3 className="section-title">📊 기본 정보</h3>
              <div className="section-content">
                <div className="info-row">
                  <span className="info-label">약품 코드:</span>
                  <span className="info-value">{itemSeq}</span>
                </div>
              </div>
            </div>
          )}

          {/* 효능 */}
          {efcyQesitm && (
            <div className="medicine-detail-section">
              <h3 className="section-title">💊 효능</h3>
              <div className="section-content">
                <p className="medicine-text">{efcyQesitm}</p>
              </div>
            </div>
          )}

          {/* 용법 */}
          {(useMethodQesitm || dosage || frequency) && (
            <div className="medicine-detail-section">
              <h3 className="section-title">📋 용법</h3>
              <div className="section-content">
                <p className="medicine-text">{useMethodQesitm || dosage || frequency || '기본 용법'}</p>
              </div>
            </div>
          )}

          {/* 주의사항 */}
          {atpnWarnQesitm && (
            <div className="medicine-detail-section">
              <h3 className="section-title">⚠️ 주의사항</h3>
              <div className="section-content">
                <p className="medicine-text warning-text">{atpnWarnQesitm}</p>
              </div>
            </div>
          )}

          {/* 상호작용 */}
          {intrcQesitm && (
            <div className="medicine-detail-section">
              <h3 className="section-title">🔗 상호작용</h3>
              <div className="section-content">
                <p className="medicine-text">{intrcQesitm}</p>
              </div>
            </div>
          )}

          {/* 부작용 */}
          {seQesitm && (
            <div className="medicine-detail-section">
              <h3 className="section-title">🚨 부작용</h3>
              <div className="section-content">
                <p className="medicine-text">{seQesitm}</p>
              </div>
            </div>
          )}

          {/* 보관 방법 */}
          {depositMethodQesitm && (
            <div className="medicine-detail-section">
              <h3 className="section-title">🏠 보관 방법</h3>
              <div className="section-content">
                <p className="medicine-text">{depositMethodQesitm}</p>
              </div>
            </div>
          )}

          {/* 정보가 없을 경우 */}
          {!efcyQesitm && !useMethodQesitm && !atpnWarnQesitm && !intrcQesitm && !seQesitm && !depositMethodQesitm && (
            <div className="medicine-detail-empty">
              <p>📄 상세 정보가 없습니다.</p>
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
