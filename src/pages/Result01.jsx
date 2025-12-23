import "./Result01.scss";
import imgworry from "../assets/images/img_worry.png";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  scoreToLifeDays,
  getLifeComment,
  formatLifeDays,
  getLifeDaysColorClass,
} from "../utils/lifeScoreUtils";
import { logActivity } from "../services/api";

const imgsorce =
  "https://img.bizthenaum.co.kr/data/img/1000000869/ori/1000000869_11.jpg";

const Result01 = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [foodName, setFoodName] = useState("");
  const [foodImage, setFoodImage] = useState(null);
  const [score, setScore] = useState(0);
  const [analysis, setAnalysis] = useState("");
  const [analysisId, setAnalysisId] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [detailedAnalysis, setDetailedAnalysis] = useState(null);

  useEffect(() => {
    console.log("Result01 - location.state:", location.state);

    if (location.state) {
      // 음식 이름
      if (location.state.foodName) {
        console.log("음식명 설정:", location.state.foodName);
        setFoodName(location.state.foodName);
      }

      // 업로드한 이미지 (File 객체)
      if (location.state.foodImage) {
        const imageUrl = URL.createObjectURL(location.state.foodImage);
        setFoodImage(imageUrl);
      } else if (location.state.imageUrl) {
        // 서버에서 저장된 이미지 URL
        setFoodImage(location.state.imageUrl);
      }

      // AI 분석 점수
      if (location.state.score !== undefined) {
        console.log("점수 설정:", location.state.score);
        setScore(location.state.score);
      }

      // AI 분석 내용
      if (location.state.analysis) {
        console.log("분석 내용 설정:", location.state.analysis);
        setAnalysis(location.state.analysis);
      }

      // 분석 ID (상세보기용)
      if (location.state.analysisId) {
        setAnalysisId(location.state.analysisId);
      }

      // 상세 분석 데이터
      if (location.state.detailedAnalysis) {
        console.log("상세 분석 설정:", location.state.detailedAnalysis);
        setDetailedAnalysis(location.state.detailedAnalysis);
      }
    } else {
      console.warn("Result01 - location.state가 없습니다!");
    }

    // cleanup function: 컴포넌트 언마운트 시 URL 해제
    return () => {
      if (location.state?.foodImage && foodImage) {
        URL.revokeObjectURL(foodImage);
      }
    };
  }, [location.state]);

  // 수명 일수 계산
  const lifeDays = scoreToLifeDays(score);
  const lifeDaysText = formatLifeDays(lifeDays);
  const lifeComment = getLifeComment(lifeDays);
  const lifeColorClass = getLifeDaysColorClass(lifeDays);

  const [isFullLoading, setIsFullLoading] = useState(false);
  const [fullStage, setFullStage] = useState(null); // 'collect' | 'interactions' | 'final'

  const handleDetailClick = async () => {
    // 활동 로그 기록 (상세분석 보기 +20일)
    try {
      await logActivity("detailed_view", analysisId, `${foodName} 상세분석`);
    } catch (e) {
      console.log("[Result01] 활동 로그 기록 실패:", e);
    }

    // 스트리밍 모드로 Result2 페이지로 이동 (Result2에서 스트리밍 처리)
    navigate("/result2", {
      state: {
        foodName,
        foodImage: location.state?.foodImage,
        imageUrl: foodImage,
        score: score, // Result01 점수를 기본값으로 전달
        analysis: analysis,
        detailedAnalysis: detailedAnalysis || null, // 있으면 전달
        analysisId: analysisId,
        useStreaming: true, // 🆕 스트리밍 모드 플래그
      },
    });
  };

  // 데이터가 없으면 로딩 또는 안내 표시
  if (!foodName && !score) {
    return (
      <div className="result01">
        <div className="result01__content">
          <div style={{ padding: "50px", textAlign: "center" }}>
            <p>분석 결과를 불러오는 중...</p>
            <p style={{ marginTop: "20px", color: "#666" }}>
              데이터가 없다면 메인 페이지에서 음식을 분석해주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="result01">
      <div className="result01__header">
        <button className="result01__back-btn" onClick={() => navigate(-1)}>
          <span className="material-symbols-rounded">arrow_back</span>
        </button>
        <h1 className="result01__food-name">[ {foodName || "음식"} ]</h1>
        <p className="result01__question">드시고 싶은가유?</p>
        {foodImage ? (
          <img src={foodImage} alt={foodName} className="result01__header-bg" />
        ) : (
          <div
            className="result01__header-bg result01__header-bg--placeholder"
            style={{ backgroundColor: "#000" }}
          >
            <span style={{ color: "#fff", fontSize: "18px" }}>
              {foodName || "음식"}
            </span>
          </div>
        )}
      </div>

      <div className="result01__content">
        {isFullLoading && (
          <div className="result01__full-overlay">
            <div className="result01__full-modal">
              <h2 className="result01__full-title">전체 심층 분석 중...</h2>
              <div className="result01__full-steps">
                <p
                  className={`result01__full-step ${
                    fullStage === "collect" ? "active" : ""
                  }`}
                >
                  📑 공공데이터 & 약물 정보 수집
                </p>
                <p
                  className={`result01__full-step ${
                    fullStage === "interactions" ? "active" : ""
                  }`}
                >
                  🔬 성분·약물 상호작용 연산
                </p>
                <p
                  className={`result01__full-step ${
                    fullStage === "final" ? "active" : ""
                  }`}
                >
                  🧠 AI 종합 정리 + 레시피
                </p>
              </div>
              <div className="result01__full-spinner"></div>
              <p className="result01__full-tip">
                잠시만 기다려주세요. 한 번만 수행되며 이후 재사용됩니다.
              </p>
            </div>
          </div>
        )}
        <div className="result01__score-section">
          <div className="result01__score-outer">
            <div
              className={`result01__score-inner result01__score-inner--${lifeColorClass}`}
            >
              <div className="result01__score-content">
                <p className="result01__score-label">예상 수명 변화</p>
                <p
                  className={`result01__score-value result01__score-value--${
                    lifeDays >= 0 ? "positive" : "negative"
                  }`}
                >
                  {lifeDaysText}
                </p>
                <p className="result01__score-comment">{lifeComment}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="result01__info-section">
          <img src={imgworry} alt={foodName} className="result01__food-image" />
          <div className="result01__info-card">
            {/* AI 200자 요약: 음식 분석 + 내 약과의 상관관계 */}
            <p
              style={{
                whiteSpace: "pre-line",
                fontSize: "15px",
                lineHeight: "1.6",
              }}
            >
              {detailedAnalysis?.briefSummary ||
                analysis ||
                "분석 결과를 불러오는 중입니다..."}
            </p>
          </div>
          <button
            className="result01__detail-button"
            onClick={handleDetailClick}
            disabled={isFullLoading}
          >
            {isFullLoading ? "상세 분석 중..." : "자세히 보기"}
          </button>
        </div>

        {/* 
          기존 추천 카드영역 제거 - 내 추천(My Recommendation) 페이지로 통합됨 
          <div className="result01__recommendations"> ... </div> 
        */}
      </div>
    </div>
  );
};

export default Result01;
