import { useState, useEffect } from "react";
import { getDailyRecommendation, logActivity } from "../services/api";
import "./MyRecommendation.scss";

const MyRecommendation = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRecommendation();
  }, []);

  const loadRecommendation = async () => {
    try {
      setIsLoading(true);
      const result = await getDailyRecommendation();
      setData(result);

      // 활동 로그 기록 (추천 보기 +10일)
      try {
        await logActivity("recommendation_view", null, "오늘의 추천 보기");
      } catch (e) {
        console.log("[MyRecommendation] 활동 로그 기록 실패:", e);
      }
    } catch (err) {
      console.error("Failed to load daily recommendation:", err);
      // Mock Data Fallback for Demo/Error case (Option: remove if strictly API dependent)
      // setError('추천을 불러오지 못했습니다.');
      // Fallback display handled in render
      setError("추천 콘텐츠를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="recommendation-page loading">
        <div className="spinner"></div>
        <p>오늘의 맞춤 추천을 생성하고 있습니다...</p>
        <p className="sub-text">AI가 사용자 정보를 분석 중입니다.</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="recommendation-page error">
        <p>{error || "데이터가 없습니다."}</p>
        <button onClick={loadRecommendation}>다시 시도</button>
      </div>
    );
  }

  const {
    food_content: food,
    remedy_content: remedy,
    exercise_content: exercise,
  } = data;

  return (
    <div className="recommendation-page">
      <header className="page-header">
        <h1>내 추천</h1>
        <p className="date-label">
          {new Date(data.date).toLocaleDateString()} 오늘의 큐레이션
        </p>
      </header>

      <div className="cards-container">
        {/* 1. Food Card */}
        <div className="card food-card">
          <div className="card-header">
            <span className="icon">🥗</span>
            <h2>오늘의 추천 음식</h2>
          </div>
          <div className="card-body">
            <h3 className="highlight-title">{food.name}</h3>
            <p className="reason-text">{food.reason}</p>
            <div className="pros-box">
              <span className="badge">Benefit</span>
              <p>{food.pros}</p>
            </div>
          </div>
        </div>

        {/* 2. Remedy Card */}
        <div className="card remedy-card">
          <div className="card-header">
            <span className="icon">🌍</span>
            <h2>세계의 민간요법</h2>
          </div>
          <div className="card-body">
            <div className="country-badge">{remedy.country}</div>
            <h3 className="highlight-title">{remedy.title}</h3>
            <p className="description-text">{remedy.description}</p>
            <div className="warning-box">
              <p>{remedy.warning}</p>
            </div>
          </div>
        </div>

        {/* 3. Exercise Card */}
        <div className="card exercise-card">
          <div className="card-header">
            <span className="icon">💪</span>
            <h2>오늘의 추천 운동</h2>
          </div>
          <div className="card-body">
            <h3 className="highlight-title">{exercise.name}</h3>
            <p className="description-text">{exercise.description}</p>
            <div className="intensity-badge">난이도: {exercise.intensity}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyRecommendation;
