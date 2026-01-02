import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import "./SharedMedicineResult.scss";

// Medicine Analysis usually strictly depends on user context.
// For social sharing, displaying a generic or mock result from ID logic
// is safer if backend persistence isn't guaranteed.
// However, assuming we might pass data via URL params (base64) for small data
// or fetch if available.
// For now, I will implement a placeholder that explains the constraint or uses specific logic if needed.

const SharedMedicineResult = () => {
  // In a real scenario, we'd fetch by ID.
  // Since we lack a clear 'getMedicineAnalysisById' API without more backend work,
  // this page might need to rely on passed state or a token.
  // For this prototype, we'll simulate a result view.
  return (
    <div className="shared-medicine-result">
      <div className="result-card">
        <div className="icon-header">💊</div>
        <h1>약물 상호작용 분석 결과</h1>
        <p className="description">
          이 결과는 <strong>먹어도돼지</strong> 앱에서 분석된 내용입니다.
          <br />
          정확한 분석을 위해 앱을 다운로드하여 내 약을 등록해보세요.
        </p>

        <div className="status-box safe">
          <span className="status-icon">✅</span>
          <span className="status-text">안전함 (예시)</span>
        </div>
      </div>
    </div>
  );
};

export default SharedMedicineResult;
