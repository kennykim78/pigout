import { useState, useEffect } from "react";
import {
  getDailyRecommendation,
  logActivity,
  getFoodRanking,
  getBalanceGame,
  submitBalanceVote,
} from "../services/api";
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
  if (videoId) {
    return <YouTubeEmbed videoId={videoId} title={title} />;
  }

  if (imageUrl) {
    return (
      <div className="card-image">
        <img src={imageUrl} alt={title} />
      </div>
    );
  }

  return null;
};

// PigRanking 컴포넌트 (실제 API 연동)
const PigRanking = () => {
  const [rankings, setRankings] = useState([]);
  const [balanceGame, setBalanceGame] = useState(null);
  const [isVoting, setIsVoting] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [loadingGame, setLoadingGame] = useState(true);

  useEffect(() => {
    loadRanking();
    loadBalanceGame();
  }, []);

  const loadRanking = async () => {
    try {
      const data = await getFoodRanking(5);
      setRankings(data || []);
    } catch (error) {
      console.error("Failed to load ranking:", error);
      // 폴백 데이터
      setRankings([
        { rank: 1, food_name: "마라탕", count: 0 },
        { rank: 2, food_name: "치킨", count: 0 },
        { rank: 3, food_name: "삼겹살", count: 0 },
      ]);
    } finally {
      setLoadingRanking(false);
    }
  };

  const loadBalanceGame = async () => {
    try {
      const data = await getBalanceGame();
      setBalanceGame(data);
    } catch (error) {
      console.error("Failed to load balance game:", error);
      // 폴백 데이터
      setBalanceGame({
        id: "fallback",
        question: "다이어트 중 참을 수 없는 유혹은?",
        optionA: { emoji: "🍕", label: "피자 한 조각", percentage: 50 },
        optionB: { emoji: "🍺", label: "맥주 한 잔", percentage: 50 },
        totalVotes: 0,
        userVote: null,
      });
    } finally {
      setLoadingGame(false);
    }
  };

  const handleVote = async (option) => {
    if (!balanceGame || balanceGame.userVote || isVoting) return;

    setIsVoting(true);
    try {
      const result = await submitBalanceVote(balanceGame.id, option);
      if (result.success) {
        // 투표 후 게임 데이터 새로고침
        await loadBalanceGame();
      } else {
        alert(result.message || "투표에 실패했습니다.");
      }
    } catch (error) {
      console.error("Vote failed:", error);
      // 오프라인 모드 지원: 로컬에서 UI만 업데이트
      setBalanceGame((prev) => ({
        ...prev,
        userVote: option,
        optionA: {
          ...prev.optionA,
          percentage: option === "A" ? 55 : 45,
        },
        optionB: {
          ...prev.optionB,
          percentage: option === "B" ? 55 : 45,
        },
        totalVotes: prev.totalVotes + 1,
      }));
    } finally {
      setIsVoting(false);
    }
  };

  const formatCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toLocaleString();
  };

  return (
    <div className="pig-ranking-section">
      {/* 랭킹 카드 */}
      <div className="ranking-card">
        <h3 className="section-title">🔥 이번 주 인기 음식 TOP 5</h3>
        {loadingRanking ? (
          <div className="loading-placeholder">불러오는 중...</div>
        ) : rankings.length > 0 ? (
          <div className="ranking-list">
            {rankings.map((item) => (
              <div key={item.rank} className="ranking-item">
                <span className={`rank-badge rank-${item.rank}`}>
                  {item.rank}
                </span>
                <span className="food-name">{item.food_name}</span>
                <span className="count">{formatCount(item.count)}회 분석</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-ranking">
            <p>아직 분석된 음식이 없어요 🥲</p>
          </div>
        )}
      </div>

      {/* 밸런스 게임 카드 */}
      <div className="vs-game-card">
        <h3 className="section-title">⚖️ 밸런스 게임</h3>
        {loadingGame ? (
          <div className="loading-placeholder">불러오는 중...</div>
        ) : balanceGame ? (
          <>
            <p className="vs-question">{balanceGame.question}</p>
            <div className="vs-options">
              <button
                className={`vs-option ${
                  balanceGame.userVote === "A" ? "selected" : ""
                } ${balanceGame.userVote ? "voted" : ""}`}
                onClick={() => handleVote("A")}
                disabled={!!balanceGame.userVote || isVoting}
              >
                <span className="emoji">{balanceGame.optionA.emoji}</span>
                <span className="label">{balanceGame.optionA.label}</span>
                {balanceGame.userVote && (
                  <div className="vote-bar">
                    <div
                      className="vote-fill"
                      style={{ width: `${balanceGame.optionA.percentage}%` }}
                    />
                    <span className="vote-percent">
                      {balanceGame.optionA.percentage}%
                    </span>
                  </div>
                )}
              </button>
              <div className="vs-divider">VS</div>
              <button
                className={`vs-option ${
                  balanceGame.userVote === "B" ? "selected" : ""
                } ${balanceGame.userVote ? "voted" : ""}`}
                onClick={() => handleVote("B")}
                disabled={!!balanceGame.userVote || isVoting}
              >
                <span className="emoji">{balanceGame.optionB.emoji}</span>
                <span className="label">{balanceGame.optionB.label}</span>
                {balanceGame.userVote && (
                  <div className="vote-bar">
                    <div
                      className="vote-fill"
                      style={{ width: `${balanceGame.optionB.percentage}%` }}
                    />
                    <span className="vote-percent">
                      {balanceGame.optionB.percentage}%
                    </span>
                  </div>
                )}
              </button>
            </div>
            {balanceGame.totalVotes > 0 && (
              <p className="total-votes">
                총 {balanceGame.totalVotes.toLocaleString()}명 참여
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
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
        {/* 0. Ranking & VS Game Section */}
        <PigRanking />

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
            {remedy.relatedLink && (
              <a
                href={remedy.relatedLink}
                target="_blank"
                rel="noopener noreferrer"
                className="related-link-btn"
              >
                📰 관련 글 보기
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
