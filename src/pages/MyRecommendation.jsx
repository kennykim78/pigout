import { useState, useEffect } from "react";
import { getDailyRecommendation, logActivity } from "../services/api";
import { useRecommendationStore } from "../store/recommendationStore";
import "./MyRecommendation.scss";

// YouTube Embed 컴포넌트
const YouTubeEmbed = ({ videoId, title }) => {
  if (!videoId) return null;

  return (
    <div className="video-embed">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

// 미디어 컴포넌트 (비디오 우선, 없으면 이미지, 둘 다 없으면 링크 버튼)
const MediaContent = ({ videoId, imageUrl, title, relatedLink }) => {
  // 1. YouTube 비디오가 있으면 embed
  if (videoId) {
    return <YouTubeEmbed videoId={videoId} title={title} />;
  }

  // 2. 비디오 없고 이미지만 있으면 이미지 표시
  if (imageUrl) {
    return (
      <div className="card-image">
        <img src={imageUrl} alt={title} />
      </div>
    );
  }

  // 3. 둘 다 없으면 null (링크 버튼은 card-body에서 별도 처리)
  return null;
};

const MyRecommendation = () => {
  const {
    data,
    setData,
    isLoading,
    setLoading,
    error,
    setError,
    shouldRefetch,
  } = useRecommendationStore();

  useEffect(() => {
    // 오늘 데이터 없으면 API 호출
    if (shouldRefetch()) {
      loadRecommendation();
    }
  }, []);

  const loadRecommendation = async () => {
    try {
      setLoading(true);
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
      setError("추천 콘텐츠를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
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
          <MediaContent
            videoId={food.videoId}
            imageUrl={food.imageUrl}
            title={food.name}
            relatedLink={food.relatedLink}
          />
          <div className="card-body">
            <h3 className="highlight-title">{food.name}</h3>
            <p className="summary-text">
              {food.summary || food.reason || food.pros}
            </p>
            {food.relatedLink && !food.videoId && (
              <a
                href={food.relatedLink}
                target="_blank"
                rel="noopener noreferrer"
                className="related-link-btn"
              >
                🔗 더 알아보기
              </a>
            )}
          </div>
        </div>

        {/* 2. Remedy Card */}
        <div className="card remedy-card">
          <div className="card-header">
            <span className="icon">🌍</span>
            <h2>세계의 민간요법</h2>
          </div>
          <MediaContent
            videoId={remedy.videoId}
            imageUrl={remedy.imageUrl}
            title={remedy.title}
            relatedLink={remedy.relatedLink}
          />
          <div className="card-body">
            <div className="country-badge">
              {remedy.flag && <span className="flag">{remedy.flag}</span>}
              {remedy.country}
            </div>
            <h3 className="highlight-title">{remedy.title}</h3>
            <p className="summary-text">
              {remedy.summary || remedy.description}
            </p>
            {remedy.relatedLink && !remedy.videoId && (
              <a
                href={remedy.relatedLink}
                target="_blank"
                rel="noopener noreferrer"
                className="related-link-btn"
              >
                🔗 더 알아보기
              </a>
            )}
          </div>
        </div>

        {/* 3. Exercise Card */}
        <div className="card exercise-card">
          <div className="card-header">
            <span className="icon">💪</span>
            <h2>오늘의 추천 운동</h2>
          </div>
          <MediaContent
            videoId={exercise.videoId}
            imageUrl={exercise.imageUrl}
            title={exercise.name}
            relatedLink={exercise.relatedLink}
          />
          <div className="card-body">
            <h3 className="highlight-title">{exercise.name}</h3>
            <p className="summary-text">
              {exercise.summary || exercise.description}
            </p>
            <div className="intensity-badge">난이도: {exercise.intensity}</div>
            {exercise.relatedLink && !exercise.videoId && (
              <a
                href={exercise.relatedLink}
                target="_blank"
                rel="noopener noreferrer"
                className="related-link-btn"
              >
                🔗 더 알아보기
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyRecommendation;
