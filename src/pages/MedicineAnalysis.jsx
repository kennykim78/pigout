import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./MedicineAnalysis.scss";

const MedicineAnalysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [analysisResult, setAnalysisResult] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    if (location.state?.analysisResult) {
      setAnalysisResult(location.state.analysisResult);
      setMedicines(location.state.medicines || []);
    } else {
      // 데이터 없으면 뒤로 가기
      navigate(-1);
    }
  }, [location.state, navigate]);

  // 스크롤 이벤트 핸들러 (Sticky Card Stack용)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const cardHeight = window.innerHeight * 0.7;
      const currentIndex = Math.min(
        Math.floor(scrollTop / cardHeight),
        5 // 최대 6개 카드
      );
      setActiveCardIndex(currentIndex);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [analysisResult]);

  if (!analysisResult) {
    return (
      <div className="medicine-analysis">
        <div className="medicine-analysis__loading">
          <p>분석 결과를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const { analysis, dataSources } = analysisResult;

  const getSafetyBadgeClass = (safety) => {
    switch (safety) {
      case "safe":
        return "medicine-analysis__safety-badge--safe";
      case "caution":
        return "medicine-analysis__safety-badge--caution";
      case "danger":
        return "medicine-analysis__safety-badge--danger";
      default:
        return "";
    }
  };

  const getSafetyText = (safety) => {
    switch (safety) {
      case "safe":
        return "✅ 안전";
      case "caution":
        return "⚠️ 주의 필요";
      case "danger":
        return "🚨 위험";
      default:
        return "";
    }
  };

  const getSafetyEmoji = (safety) => {
    switch (safety) {
      case "safe":
        return "😊";
      case "caution":
        return "🤔";
      case "danger":
        return "😰";
      default:
        return "💊";
    }
  };

  return (
    <div className="medicine-analysis">
      {/* 헤더 */}
      <header className="medicine-analysis__header">
        <button
          className="medicine-analysis__back-btn"
          onClick={() => navigate(-1)}
        >
          <span className="material-symbols-rounded">arrow_back</span>
        </button>
        <button
          className="medicine-analysis__share-btn"
          onClick={() => {
            if (navigator.share) {
              navigator
                .share({
                  title: `[먹어도돼지] 약물 상호작용 분석`,
                  text: `내 약물 (${medicines.length}개) 상호작용 분석 결과입니다.`,
                  url: `${window.location.origin}/share/medicine/shared-id`,
                })
                .catch(console.error);
            } else {
              navigator.clipboard.writeText(
                `${window.location.origin}/share/medicine/shared-id`
              );
              alert("링크가 복사되었습니다!");
            }
          }}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "#000",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "white",
          }}
        >
          <span className="material-symbols-rounded">share</span>
        </button>
        <div
          className="medicine-analysis__header-info"
          style={{ marginLeft: "10px" }}
        >
          <h1 className="medicine-analysis__title">💊 약물 상호작용 분석</h1>
          <p className="medicine-analysis__subtitle">
            {medicines.length}개 약물 분석 완료
          </p>
        </div>
      </header>

      {/* 메인 컨텐츠 - 스크롤 영역 */}
      <div className="medicine-analysis__content" ref={containerRef}>
        {/* 인디케이터 */}
        <div className="medicine-analysis__indicator">
          {activeCardIndex + 1}/6
        </div>

        {/* 카드 스택 */}
        <div className="medicine-analysis__stack">
          {/* 1. 전체 안전도 카드 */}
          <div
            className={`medicine-analysis__card ${
              activeCardIndex === 0 ? "active" : ""
            } ${activeCardIndex > 0 ? "passed" : ""}`}
          >
            <div className="analysis-card analysis-card--safety">
              <h2 className="analysis-card__title">🎯 종합 안전도</h2>
              <div className="safety-overview">
                <div className="safety-overview__emoji">
                  {getSafetyEmoji(analysis.overallSafety)}
                </div>
                <div
                  className={`safety-overview__badge ${getSafetyBadgeClass(
                    analysis.overallSafety
                  )}`}
                >
                  {getSafetyText(analysis.overallSafety)}
                </div>
                <div className="safety-overview__score">
                  <span className="safety-overview__score-number">
                    {analysis.overallScore}
                  </span>
                  <span className="safety-overview__score-unit">/100점</span>
                </div>
              </div>
              <p className="analysis-card__summary">{analysis.summary}</p>
            </div>
          </div>

          {/* 2. 위험한 조합 카드 */}
          <div
            className={`medicine-analysis__card ${
              activeCardIndex === 1 ? "active" : ""
            } ${activeCardIndex > 1 ? "passed" : ""}`}
          >
            <div className="analysis-card analysis-card--danger">
              <h2 className="analysis-card__title">
                🚨 위험한 조합
                {analysis.dangerousCombinations?.length > 0 && (
                  <span className="analysis-card__count">
                    {analysis.dangerousCombinations.length}개
                  </span>
                )}
              </h2>
              {analysis.dangerousCombinations?.length > 0 ? (
                <div className="interaction-list">
                  {analysis.dangerousCombinations.map((combo, idx) => (
                    <div
                      key={idx}
                      className="interaction-item interaction-item--danger"
                    >
                      <div className="interaction-item__header">
                        <span className="interaction-item__drug">
                          {combo.drug1}
                        </span>
                        <span className="interaction-item__icon">⚡</span>
                        <span className="interaction-item__drug">
                          {combo.drug2}
                        </span>
                      </div>
                      <p className="interaction-item__desc">
                        {combo.interaction}
                      </p>
                      <div className="interaction-item__recommendation">
                        💡 <strong>권장사항:</strong> {combo.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-state__icon">✅</span>
                  <p className="empty-state__text">위험한 조합이 없습니다</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. 주의 필요 조합 카드 */}
          <div
            className={`medicine-analysis__card ${
              activeCardIndex === 2 ? "active" : ""
            } ${activeCardIndex > 2 ? "passed" : ""}`}
          >
            <div className="analysis-card analysis-card--caution">
              <h2 className="analysis-card__title">
                ⚠️ 주의 필요
                {analysis.cautionCombinations?.length > 0 && (
                  <span className="analysis-card__count">
                    {analysis.cautionCombinations.length}개
                  </span>
                )}
              </h2>
              {analysis.cautionCombinations?.length > 0 ? (
                <div className="interaction-list">
                  {analysis.cautionCombinations.map((combo, idx) => (
                    <div
                      key={idx}
                      className="interaction-item interaction-item--caution"
                    >
                      <div className="interaction-item__header">
                        <span className="interaction-item__drug">
                          {combo.drug1}
                        </span>
                        <span className="interaction-item__icon">+</span>
                        <span className="interaction-item__drug">
                          {combo.drug2}
                        </span>
                      </div>
                      <p className="interaction-item__desc">
                        {combo.interaction}
                      </p>
                      <div className="interaction-item__recommendation">
                        💡 <strong>권장사항:</strong> {combo.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-state__icon">✅</span>
                  <p className="empty-state__text">주의 필요 조합이 없습니다</p>
                </div>
              )}
            </div>
          </div>

          {/* 4. 긍정적 효과 카드 */}
          <div
            className={`medicine-analysis__card ${
              activeCardIndex === 3 ? "active" : ""
            } ${activeCardIndex > 3 ? "passed" : ""}`}
          >
            <div className="analysis-card analysis-card--synergy">
              <h2 className="analysis-card__title">
                ✨ 긍정적 효과
                {analysis.synergisticEffects?.length > 0 && (
                  <span className="analysis-card__count">
                    {analysis.synergisticEffects.length}개
                  </span>
                )}
              </h2>
              {analysis.synergisticEffects?.length > 0 ? (
                <div className="interaction-list">
                  {analysis.synergisticEffects.map((effect, idx) => (
                    <div
                      key={idx}
                      className="interaction-item interaction-item--synergy"
                    >
                      <div className="interaction-item__header">
                        <span className="interaction-item__drugs">
                          {effect.drugs.join(" + ")}
                        </span>
                      </div>
                      <p className="interaction-item__benefit">
                        💚 {effect.benefit}
                      </p>
                      <p className="interaction-item__desc">
                        {effect.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-state__icon">💤</span>
                  <p className="empty-state__text">
                    특별한 시너지 효과가 없습니다
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 5. 복용 가이드 카드 */}
          <div
            className={`medicine-analysis__card ${
              activeCardIndex === 4 ? "active" : ""
            } ${activeCardIndex > 4 ? "passed" : ""}`}
          >
            <div className="analysis-card analysis-card--guide">
              <h2 className="analysis-card__title">📌 복용 가이드</h2>
              {analysis.recommendations?.length > 0 ? (
                <ul className="guide-list">
                  {analysis.recommendations.map((rec, idx) => (
                    <li key={idx} className="guide-list__item">
                      <span className="guide-list__icon">✓</span>
                      <span className="guide-list__text">{rec}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <span className="empty-state__icon">📝</span>
                  <p className="empty-state__text">
                    특별한 권장사항이 없습니다
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 6. 데이터 출처 카드 */}
          <div
            className={`medicine-analysis__card ${
              activeCardIndex === 5 ? "active" : ""
            }`}
          >
            <div className="analysis-card analysis-card--sources">
              <h2 className="analysis-card__title">📊 데이터 출처</h2>
              {dataSources?.length > 0 ? (
                <ul className="source-list">
                  {dataSources.map((source, idx) => (
                    <li key={idx} className="source-list__item">
                      <span className="source-list__icon">📁</span>
                      <span className="source-list__text">{source}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="source-list__fallback">AI 분석 기반</p>
              )}

              {/* 면책 조항 */}
              <div className="disclaimer">
                <p>
                  ※ 본 분석은 AI 및 공공데이터를 기반으로 하며, 의학적 진단을
                  대체할 수 없습니다. 정확한 정보는 의사 또는 약사와 상담하세요.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 스크롤 공간 */}
        <div className="medicine-analysis__scroll-space" />
      </div>

      {/* 하단 버튼 */}
      <div className="medicine-analysis__footer">
        <button
          className="medicine-analysis__footer-btn"
          onClick={() => navigate(-1)}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
};

export default MedicineAnalysis;
