import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFeed,
  toggleLike,
  toggleLoungeBookmark,
  reportPost,
} from "../services/api"; // API import
import "./PigLounge.scss";

const PigLounge = () => {
  const navigate = useNavigate();
  const [feedItems, setFeedItems] = useState([]);

  const [loading, setLoading] = useState(true);

  // Load feed from API or fallback
  const loadFeed = async () => {
    try {
      const data = await getFeed();
      // API 데이터가 있으면 사용, 없으면 로컬 데이터(혹은 빈배열)
      if (data && data.length > 0) {
        setFeedItems(data);
      } else {
        fallbackToLocal();
      }
    } catch (error) {
      console.warn("Feed API fetch failed, falling back to local:", error);
      fallbackToLocal();
    } finally {
      setLoading(false);
    }
  };

  const fallbackToLocal = () => {
    const savedPosts = JSON.parse(
      localStorage.getItem("pigout_feed_posts") || "[]"
    );
    const defaultMock = [
      {
        id: 1,
        user: "치킨킬러",
        foodName: "황금올리브 치킨",
        score: 15,
        lifeChange: -15,
        comment: "오늘만 산다... 그래도 맛있는걸 어떡해 🍗",
        likes: 24,
        isLiked: false,
        isBookmarked: false,
        date: "방금 전",
        image: "🐔",
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
        isBookmarked: true,
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
        isBookmarked: false,
        date: "1시간 전",
        image: "🥘",
        tags: ["#마라탕", "#맵찔이", "#스트레스"],
      },
    ];
    setFeedItems([...savedPosts, ...defaultMock]);
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handleLike = async (id) => {
    // Optimistic Update
    setFeedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            isLiked: !item.isLiked,
            likes: item.isLiked ? item.likes - 1 : item.likes + 1,
          };
        }
        return item;
      })
    );

    try {
      if (
        typeof id === "string" &&
        !id.toString().startsWith("mock") &&
        !id.toString().match(/^\d+$/)
      ) {
        await toggleLike(id);
      }
    } catch (e) {
      console.error("Like failed", e);
    }
  };

  const handleBookmark = async (id) => {
    setFeedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, isBookmarked: !item.isBookmarked };
        }
        return item;
      })
    );

    try {
      if (
        typeof id === "string" &&
        !id.toString().startsWith("mock") &&
        !id.toString().match(/^\d+$/)
      ) {
        await toggleLoungeBookmark(id);
      }
    } catch (e) {
      console.error("Bookmark failed", e);
    }
  };

  const handleShare = async (item) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `[피그라운지] ${item.user}님의 기록`,
          text: `"${item.foodName}" 먹고 ${item.lifeChange}일 변화?! ${item.comment}`,
          url: window.location.href, // Or specific item link if available
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      alert("링크가 복사되었습니다!");
    }
  };

  const handleReport = async (id) => {
    // 1. 확인 팝업
    if (
      !window.confirm(
        "정말 이 게시물을 신고하시겠습니까? 운영 정책에 위배되는 경우 숨김 처리됩니다."
      )
    )
      return;

    // 2. 신고 API 호출
    try {
      if (
        typeof id === "string" &&
        !id.toString().startsWith("mock") &&
        !id.toString().match(/^\d+$/)
      ) {
        await reportPost(id, "사용자 신고");
        alert(
          "신고가 접수되었습니다. 깨끗한 피그라운드를 위해 노력해주셔서 감사합니다."
        );

        // UI에서 숨김 처리 (옵션)
        setFeedItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert("신고가 접수되었습니다. (Mock Data)");
        setFeedItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (error) {
      console.error("Report failed:", error);
      alert("신고 접수 중 오류가 발생했습니다.");
    }
  };

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
              <button
                className="feed-card__more"
                onClick={() => {
                  // 간단하게 바로 신고 로직 연결 (실제로는 드롭다운 메뉴가 더 좋음)
                  handleReport(item.id);
                }}
              >
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
              <button
                className={`action-btn ${item.isLiked ? "active" : ""}`}
                onClick={() => handleLike(item.id)}
              >
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
              <button
                className="action-btn share"
                onClick={() => handleShare(item)}
              >
                <span className="material-symbols-rounded">share</span>
              </button>
              <button
                className={`action-btn bookmark ${
                  item.isBookmarked ? "active" : ""
                }`}
                onClick={() => handleBookmark(item.id)}
              >
                <span className="material-symbols-rounded">
                  {item.isBookmarked ? "bookmark" : "bookmark_border"}
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
        onClick={() => navigate("/lounge/write")}
      >
        <span className="material-symbols-rounded">edit</span>
      </button>
    </div>
  );
};

export default PigLounge;
