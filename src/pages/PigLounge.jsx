import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PigLounge.scss";

const PigLounge = () => {
  const navigate = useNavigate();
  // Mock Data for Feed
  const [feedItems] = useState([
    {
      id: 1,
      user: "치킨킬러",
      foodName: "황금올리브 치킨",
      score: 15,
      lifeChange: -15, // 수명 변화 (일)
      comment: "오늘만 산다... 그래도 맛있는걸 어떡해 🍗",
      likes: 24,
      isLiked: false,
      date: "방금 전",
      image: "🐔", // 실제 이미지 대신 이모지 사용 (나중에 실제 이미지로 교체 가능)
      tags: ["#치킨", "#야식", "#행복"],
    },
    {
      id: 2,
      user: "건강지킴이",
      foodName: "연어 샐러드",
      score: 95,
      lifeChange: 45,
      comment: "가볍게 먹고 운동가야지! 🥗",
      likes: 156,
      isLiked: true,
      date: "10분 전",
      image: "🥗",
      tags: ["#다이어트", "#식단", "#연어"],
    },
    {
      id: 3,
      user: "마라탕중독",
      foodName: "마라탕 3단계",
      score: 10,
      lifeChange: -25,
      comment: "스트레스 풀 때는 역시 마라탕이지 🔥",
      likes: 89,
      isLiked: false,
      date: "1시간 전",
      image: "🥘",
      tags: ["#마라탕", "#맵찔이", "#스트레스"],
    },
  ]);

  return (
    <div className="pig-lounge">
      <header className="pig-lounge__header">
        <h1 className="pig-lounge__title">피그라운지</h1>
        <div className="pig-lounge__actions">
          <button className="pig-lounge__icon-btn">
            <span className="material-symbols-rounded">notifications</span>
            <span className="badge">N</span>
          </button>
        </div>
      </header>

      <div className="pig-lounge__feed">
        {feedItems.map((item) => (
          <div key={item.id} className="feed-card">
            <div className="feed-card__header">
              <div className="feed-card__avatar">{item.user[0]}</div>
              <div className="feed-card__user-info">
                <span className="username">{item.user}</span>
                <span className="time">{item.date}</span>
              </div>
              <button className="feed-card__more">
                <span className="material-symbols-rounded">more_horiz</span>
              </button>
            </div>

            <div
              className={`feed-card__content ${
                item.lifeChange >= 0 ? "good" : "bad"
              }`}
            >
              <div className="feed-card__main-visual">
                <span className="food-emoji">{item.image}</span>
                <div className="food-score-badge">
                  <span className="label">수명</span>
                  <span className="value">
                    {item.lifeChange > 0 ? "+" : ""}
                    {item.lifeChange}일
                  </span>
                </div>
              </div>

              <div className="feed-card__details">
                <h3 className="food-name">{item.foodName}</h3>
                <p className="comment">{item.comment}</p>
                <div className="tags">
                  {item.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="feed-card__actions">
              <button className={`action-btn ${item.isLiked ? "active" : ""}`}>
                <span className="material-symbols-rounded">
                  {item.isLiked ? "favorite" : "favorite_border"}
                </span>
                <span className="count">{item.likes}</span>
              </button>
              <button className="action-btn">
                <span className="material-symbols-rounded">
                  chat_bubble_outline
                </span>
                <span className="count">댓글</span>
              </button>
              <button className="action-btn share">
                <span className="material-symbols-rounded">share</span>
              </button>
              <button className="action-btn bookmark">
                <span className="material-symbols-rounded">
                  bookmark_border
                </span>
              </button>
            </div>
          </div>
        ))}

        <div className="feed-end">
          <p>모든 피드를 다 보셨어요! 🐷</p>
        </div>
      </div>

      <button
        className="pig-lounge__write-btn"
        onClick={() => alert("준비 중인 기능입니다!")}
      >
        <span className="material-symbols-rounded">edit</span>
      </button>
    </div>
  );
};

export default PigLounge;
