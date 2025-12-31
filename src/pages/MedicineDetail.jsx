import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./MedicineDetail.scss";

const MedicineDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [medicine, setMedicine] = useState(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  useEffect(() => {
    if (location.state?.medicine) {
      setMedicine(location.state.medicine);
    } else {
      // 데이터 없으면 뒤로 가기
      navigate(-1);
    }
  }, [location.state, navigate]);

  if (!medicine) {
    return (
      <div className="medicine-detail">
        <div className="medicine-detail__loading">
          <p>약품 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 🧠 qr_code_data에서 AI 분석 정보 추출
  let parsedData = {};
  let aiInfo = null;
  try {
    if (medicine.qr_code_data) {
      parsedData =
        typeof medicine.qr_code_data === "string"
          ? JSON.parse(medicine.qr_code_data)
          : medicine.qr_code_data;
      aiInfo = parsedData.aiAnalyzedInfo;
    }
  } catch (e) {
    console.warn("[MedicineDetail] qr_code_data 파싱 실패:", e);
  }

  const {
    itemName = "",
    entpName = "",
    itemSeq = "",
    efcyQesitm = "",
    useMethodQesitm = "",
    atpnWarnQesitm = "",
    intrcQesitm = "",
    seQesitm = "",
    depositMethodQesitm = "",
    name = itemName,
    dosage = useMethodQesitm,
  } = medicine;

  // 🆕 공공데이터 우선, 없으면 parsedData, 최종적으로 AI 정보 사용
  const displayEfficacy =
    efcyQesitm || parsedData.efcyQesitm || aiInfo?.efficacy || "";
  const displayUsage =
    useMethodQesitm ||
    parsedData.useMethodQesitm ||
    dosage ||
    aiInfo?.usage ||
    "";
  const displayPrecautions =
    atpnWarnQesitm || parsedData.atpnWarnQesitm || aiInfo?.precautions || "";
  const displayInteractions =
    intrcQesitm || parsedData.intrcQesitm || aiInfo?.interactions || "";
  const displaySideEffects =
    seQesitm || parsedData.seQesitm || aiInfo?.sideEffects || "";
  const displayStorage =
    depositMethodQesitm ||
    parsedData.depositMethodQesitm ||
    aiInfo?.storageMethod ||
    "";

  // 데이터 완성도 표시
  const dataSource =
    aiInfo?.dataCompleteness === "complete"
      ? "공공데이터"
      : aiInfo?.dataCompleteness === "partial"
      ? "공공데이터 + AI 보완"
      : aiInfo?.dataCompleteness === "ai_enhanced"
      ? "AI 분석"
      : null;

  // 카드 섹션 데이터
  const sections = [
    {
      id: "efficacy",
      title: "💊 효능·효과",
      content: displayEfficacy,
      highlight: true,
    },
    {
      id: "usage",
      title: "📋 용법·용량",
      content: displayUsage,
      highlight: true,
    },
    {
      id: "precautions",
      title: "⚠️ 주의사항",
      content: displayPrecautions,
      highlight: false,
      isWarning: true,
    },
    {
      id: "interactions",
      title: "🔗 상호작용",
      content: displayInteractions,
      highlight: false,
    },
    {
      id: "sideEffects",
      title: "🚨 부작용",
      content: displaySideEffects,
      highlight: false,
      isDanger: true,
    },
    {
      id: "storage",
      title: "🏠 보관 방법",
      content: displayStorage,
      highlight: false,
    },
  ].filter((section) => section.content); // 내용이 있는 섹션만 표시

  const hasNoInfo = sections.length === 0;

  return (
    <div className="medicine-detail">
      {/* 헤더 */}
      <header className="medicine-detail__header">
        <button
          className="medicine-detail__back-btn"
          onClick={() => navigate(-1)}
        >
          <span className="material-symbols-rounded">arrow_back</span>
        </button>
        <div className="medicine-detail__header-info">
          <h1 className="medicine-detail__title">
            {itemName || name || "약품명 미확인"}
          </h1>
          <p className="medicine-detail__company">
            {entpName || "제조사 미확인"}
          </p>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <div className="medicine-detail__content">
        {/* 데이터 출처 표시 */}
        {dataSource && (
          <div className="medicine-detail__source">
            <span className="medicine-detail__source-icon">📊</span>
            <span className="medicine-detail__source-text">
              정보 출처: {dataSource}
            </span>
          </div>
        )}

        {/* 카드 목록 */}
        {!hasNoInfo ? (
          <div className="medicine-detail__cards">
            {sections.map((section, index) => (
              <div
                key={section.id}
                className={`medicine-detail__card ${
                  section.highlight ? "medicine-detail__card--highlight" : ""
                } ${
                  section.isWarning ? "medicine-detail__card--warning" : ""
                } ${section.isDanger ? "medicine-detail__card--danger" : ""}`}
              >
                <h2 className="medicine-detail__card-title">{section.title}</h2>
                <div className="medicine-detail__card-content">
                  <p>{section.content}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="medicine-detail__empty">
            <span className="medicine-detail__empty-icon">📄</span>
            <p className="medicine-detail__empty-text">상세 정보가 없습니다.</p>
            <p className="medicine-detail__empty-hint">
              약품을 다시 등록하시면 AI가 정보를 보완합니다.
            </p>
          </div>
        )}

        {/* 등록 정보 */}
        {itemSeq && (
          <div className="medicine-detail__meta">
            <span className="medicine-detail__meta-label">품목기준코드</span>
            <span className="medicine-detail__meta-value">{itemSeq}</span>
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="medicine-detail__footer">
        <button
          className="medicine-detail__footer-btn"
          onClick={() => navigate(-1)}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
};

export default MedicineDetail;
