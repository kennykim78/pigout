import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getActivityHistory, createPost } from "../services/api";
import "./PigLoungeWrite.scss";

const PigLoungeWrite = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const result = await getActivityHistory(10, 0); // Recent 10 items
      // Filter only food analysis
      const foodItems =
        result?.historyList?.flatMap((day) =>
          day.items.filter((item) => item.type === "food_analysis")
        ) || [];
      setHistory(foodItems);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedItem) {
      alert("공유할 맛있는 기록을 선택해주세요! 🐷");
      return;
    }
    if (!comment.trim()) {
      alert("친구들에게 할 말을 적어주세요!");
      return;
    }

    const postData = {
      foodName: selectedItem.name,
      score: selectedItem.score || 100, // 점수 데이터가 있다면
      lifeChange: selectedItem.change || 0,
      comment: comment,
      imageUrl: selectedItem.imageUrl || "🍽️", // 실제 이미지 URL 사용 필요
      tags: tags.split(" ").filter((t) => t.startsWith("#") && t.length > 1),
    };

    try {
      await createPost(postData);
      // Fallback for immediate UX (optional if API is fast, but good for hybrid)
      // Also save to local for offline support or immediate transition
    } catch (error) {
      console.warn("Post creation failed, saving locally:", error);

      const newPost = {
        id: Date.now(),
        user: "나야나",
        ...postData,
        likes: 0,
        isLiked: false,
        date: "방금 전",
        isMyPost: true,
      };

      const savedPosts = JSON.parse(
        localStorage.getItem("pigout_feed_posts") || "[]"
      );
      localStorage.setItem(
        "pigout_feed_posts",
        JSON.stringify([newPost, ...savedPosts])
      );
    }

    navigate("/lounge");
  };

  return (
    <div className="pig-lounge-write">
      <header className="write-header">
        <button className="close-btn" onClick={() => navigate(-1)}>
          <span className="material-symbols-rounded">close</span>
        </button>
        <h1>글 쓰기</h1>
        <button className="submit-btn" onClick={handleSubmit}>
          공유
        </button>
      </header>

      <div className="write-content">
        <section className="selection-section">
          <h2>어떤 걸 먹었나요?</h2>
          {loading ? (
            <div className="loading-state">기록 불러오는 중...</div>
          ) : history.length > 0 ? (
            <div className="history-list">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`history-item ${
                    selectedItem?.id === item.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="icon">🍽️</div>
                  <div className="info">
                    <span className="name">{item.name}</span>
                    <span className="date">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  {item.change && (
                    <span
                      className={`change ${item.change > 0 ? "good" : "bad"}`}
                    >
                      {item.change > 0 ? "+" : ""}
                      {item.change}일
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>최근 분석 기록이 없어요 🥲</p>
              <button onClick={() => navigate("/main")}>분석하러 가기</button>
            </div>
          )}
        </section>

        <section className="input-section">
          <textarea
            placeholder="이 음식은 어땠나요? 솔직한 후기를 남겨보세요! (예: 역시 야식은 치킨이지!)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <input
            type="text"
            className="tag-input"
            placeholder="태그 입력 (예: #존맛 #야식)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </section>
      </div>
    </div>
  );
};

export default PigLoungeWrite;
