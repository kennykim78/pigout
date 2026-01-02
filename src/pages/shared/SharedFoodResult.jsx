import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getFoodAnalysis } from "../../services/api";
import "./SharedFoodResult.scss";

const SharedFoodResult = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (analysisId) => {
    try {
      setLoading(true);
      const result = await getFoodAnalysis(analysisId);
      setData(result);
    } catch (err) {
      setError("분석 결과를 찾을 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="shared-page loading">로딩 중...</div>;
  if (error || !data) return <div className="shared-page error">{error}</div>;

  const { foodName, score, analysis, imageUrl } = data;

  // 간단한 수명 텍스트 변환 (백엔드 로직에 맞춰 조정 가능)
  // 여기서는 score를 사용하여 임의로 계산하거나 실제 데이터 필드를 사용해야 함
  // 기존 Result Pages 로직 참조
  const lifeDays = Math.round((score - 80) * 10); // 임시 로직

  return (
    <div className="shared-food-result">
      <div className="result-card">
        <div className="food-image">
          {imageUrl ? (
            <img src={imageUrl} alt={foodName} />
          ) : (
            <span className="emoji">🍽️</span>
          )}
          <div className="score-badge">
            <span className="score">{score}</span>
            <span className="label">점</span>
          </div>
        </div>

        <div className="content">
          <h1 className="title">{foodName}</h1>
          <div className="life-change">
            <span className="label">예상 수명</span>
            <span
              className={`value ${lifeDays >= 0 ? "positive" : "negative"}`}
            >
              {lifeDays > 0 ? "+" : ""}
              {lifeDays}일
            </span>
          </div>

          <p className="summary">
            {analysis?.summary || "분석 결과가 없습니다."}
          </p>

          <div className="details">
            {analysis?.nutrients && (
              <div className="detail-item">
                <h3>영양 성분</h3>
                <p>{analysis.nutrients}</p>
              </div>
            )}
            {analysis?.pros && (
              <div className="detail-item">
                <h3>장점</h3>
                <p>{analysis.pros}</p>
              </div>
            )}
            {analysis?.cons && (
              <div className="detail-item">
                <h3>단점</h3>
                <p>{analysis.cons}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedFoodResult;
