import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFeed,
  toggleLike,
  toggleLoungeBookmark,
  reportPost,
  getComments,
  createComment,
  deletePost,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
} from "../services/api";
import { getDeviceId } from "../utils/deviceId";
import "./PigLounge.scss";

const PigLounge = () => {
  const navigate = useNavigate();
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  // 드롭다운 메뉴 상태
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);
  const notificationRef = useRef(null);

  // 댓글 관련 상태
  const [expandedComments, setExpandedComments] = useState({});
  const [commentsData, setCommentsData] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [loadingComments, setLoadingComments] = useState({});

  // 알림 관련 상태
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // 현재 사용자 ID 가져오기 & 알림 개수 로드
  useEffect(() => {
    const deviceId = getDeviceId();
    setCurrentUserId(deviceId);
    loadUnreadCount();
  }, []);

  // 읽지 않은 알림 개수 로드
  const loadUnreadCount = async () => {
    try {
      const result = await getUnreadNotificationCount();
      setUnreadCount(result.count || 0);
    } catch (error) {
      console.error("Failed to load unread count:", error);
    }
  };

  // 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 알림 패널 토글
  const handleNotificationClick = async () => {
    if (!showNotifications) {
      setShowNotifications(true);
      setLoadingNotifications(true);
      try {
        const data = await getNotifications(20, 0);
        setNotifications(data || []);
        // 전체 읽음 처리
        if (unreadCount > 0) {
          await markAllNotificationsAsRead();
          setUnreadCount(0);
        }
      } catch (error) {
        console.error("Failed to load notifications:", error);
      } finally {
        setLoadingNotifications(false);
      }
    } else {
      setShowNotifications(false);
    }
  };

  // 알림 시간 포맷
  const formatNotificationTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString();
  };

  // Load feed from API or fallback
  const loadFeed = async () => {
    try {
      const data = await getFeed();
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
        user_id: "mock-user-1",
        foodName: "황금올리브 치킨",
        food_name: "황금올리브 치킨",
        score: 15,
        lifeChange: -15,
        life_change: -15,
        comment: "오늘만 산다... 그래도 맛있는걸 어떡해 🍗",
        likes: 24,
        like_count: 24,
        comment_count: 3,
        isLiked: false,
        isBookmarked: false,
        date: "방금 전",
        image: "🐔",
        tags: ["#치킨", "#야식", "#행복"],
        post_type: "food",
      },
      {
        id: 2,
        user: "건강지킴이",
        user_id: "mock-user-2",
        foodName: "연어 샐러드",
        food_name: "연어 샐러드",
        score: 95,
        lifeChange: 45,
        life_change: 45,
        comment: "가볍게 먹고 운동가야지! 🥗",
        likes: 156,
        like_count: 156,
        comment_count: 12,
        isLiked: true,
        isBookmarked: true,
        date: "10분 전",
        image: "🥗",
        tags: ["#다이어트", "#식단", "#연어"],
        post_type: "food",
      },
      {
        id: 3,
        user: "마라탕중독",
        user_id: "mock-user-3",
        foodName: "마라탕 3단계",
        food_name: "마라탕 3단계",
        score: 10,
        lifeChange: -25,
        life_change: -25,
        comment: "스트레스 풀 때는 역시 마라탕이지 🔥",
        likes: 89,
        like_count: 89,
        comment_count: 5,
        isLiked: false,
        isBookmarked: false,
        date: "1시간 전",
        image: "🥘",
        tags: ["#마라탕", "#맵찔이", "#스트레스"],
        post_type: "food",
      },
    ];
    setFeedItems([...savedPosts, ...defaultMock]);
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handleLike = async (id) => {
    setFeedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newLikeCount = item.isLiked
            ? (item.like_count || item.likes || 1) - 1
            : (item.like_count || item.likes || 0) + 1;
          return {
            ...item,
            isLiked: !item.isLiked,
            likes: newLikeCount,
            like_count: newLikeCount,
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
          title: `[피그라운지] ${item.user || item.nickname}님의 기록`,
          text: `"${item.food_name || item.foodName}" 먹고 ${
            item.life_change || item.lifeChange
          }일 변화?! ${item.comment}`,
          url: window.location.href,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      alert("링크가 복사되었습니다!");
    }
  };

  // 드롭다운 메뉴 토글
  const handleMenuToggle = (id, e) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  // 신고하기
  const handleReport = async (id) => {
    setOpenMenuId(null);

    if (
      !window.confirm(
        "정말 이 게시물을 신고하시겠습니까? 운영 정책에 위배되는 경우 숨김 처리됩니다."
      )
    )
      return;

    try {
      if (
        typeof id === "string" &&
        !id.toString().startsWith("mock") &&
        !id.toString().match(/^\d+$/)
      ) {
        await reportPost(id, "사용자 신고");
        alert(
          "신고가 접수되었습니다. 깨끗한 피그라운지를 위해 노력해주셔서 감사합니다. 🐷"
        );
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

  // 수정하기
  const handleEdit = (item) => {
    setOpenMenuId(null);
    navigate("/lounge/write", { state: { editMode: true, post: item } });
  };

  // 삭제하기
  const handleDelete = async (id) => {
    setOpenMenuId(null);

    if (!window.confirm("정말 이 게시물을 삭제하시겠습니까?")) return;

    try {
      if (
        typeof id === "string" &&
        !id.toString().startsWith("mock") &&
        !id.toString().match(/^\d+$/)
      ) {
        await deletePost(id);
        alert("게시물이 삭제되었습니다.");
      }
      setFeedItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Delete failed:", error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  // 댓글 펼치기/접기
  const toggleComments = async (postId) => {
    const isExpanded = expandedComments[postId];

    if (!isExpanded && !commentsData[postId]) {
      setLoadingComments((prev) => ({ ...prev, [postId]: true }));
      try {
        const comments = await getComments(postId);
        setCommentsData((prev) => ({ ...prev, [postId]: comments }));
      } catch (error) {
        console.error("Failed to load comments:", error);
        setCommentsData((prev) => ({ ...prev, [postId]: [] }));
      } finally {
        setLoadingComments((prev) => ({ ...prev, [postId]: false }));
      }
    }

    setExpandedComments((prev) => ({ ...prev, [postId]: !isExpanded }));
  };

  // 댓글 작성
  const handleSubmitComment = async (postId) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;

    try {
      const newComment = await createComment(postId, content);

      // 댓글 목록에 추가
      setCommentsData((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));

      // 피드 아이템의 댓글 수 업데이트
      setFeedItems((prev) =>
        prev.map((item) =>
          item.id === postId
            ? { ...item, comment_count: (item.comment_count || 0) + 1 }
            : item
        )
      );

      // 입력 필드 초기화
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    } catch (error) {
      console.error("Failed to create comment:", error);
      alert(error.response?.data?.message || "댓글 작성에 실패했습니다.");
    }
  };

  // 자신의 글인지 확인
  const isOwnPost = (item) => {
    // API에서 user_id 필드를 사용하거나 isMyPost 플래그 확인
    return item.isMyPost || item.user_id === currentUserId;
  };

  // 날짜 포맷팅
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString();
  };

  return (
    <div className="pig-lounge">
      <header className="pig-lounge__header">
        <h1 className="pig-lounge__title">피그라운지</h1>
        <div className="pig-lounge__actions" ref={notificationRef}>
          <button
            className="pig-lounge__icon-btn"
            onClick={handleNotificationClick}
          >
            <span className="material-symbols-rounded">notifications</span>
            {unreadCount > 0 && (
              <span className="badge">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* 알림 패널 */}
          {showNotifications && (
            <div className="notification-panel">
              <div className="notification-panel__header">
                <h3>알림</h3>
              </div>
              <div className="notification-panel__list">
                {loadingNotifications ? (
                  <div className="notification-loading">불러오는 중...</div>
                ) : notifications.length > 0 ? (
                  notifications.map((noti) => (
                    <div
                      key={noti.id}
                      className={`notification-item ${
                        noti.is_read ? "" : "unread"
                      }`}
                      onClick={() => {
                        if (noti.post_id) {
                          setShowNotifications(false);
                          // 해당 게시물로 스크롤 또는 상세 보기
                        }
                      }}
                    >
                      <div className="notification-icon">
                        {noti.type === "like" && "❤️"}
                        {noti.type === "comment" && "💬"}
                        {noti.type === "bookmark" && "⭐"}
                        {noti.type === "system" && "📢"}
                      </div>
                      <div className="notification-content">
                        <p className="notification-message">{noti.message}</p>
                        <span className="notification-time">
                          {formatNotificationTime(noti.created_at)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="notification-empty">
                    <span className="emoji">🐷</span>
                    <p>아직 알림이 없어요!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="pig-lounge__feed">
        {feedItems.map((item) => (
          <div key={item.id} className="feed-card">
            <div className="feed-card__header">
              <div className="feed-card__avatar">
                {(item.user || item.nickname || "익")[0]}
              </div>
              <div className="feed-card__user-info">
                <span className="username">
                  {item.user || item.nickname || "익명"}
                </span>
                <span className="time">
                  {item.date || formatDate(item.created_at)}
                </span>
              </div>
              <div className="feed-card__menu-wrapper" ref={menuRef}>
                <button
                  className="feed-card__more"
                  onClick={(e) => handleMenuToggle(item.id, e)}
                >
                  <span className="material-symbols-rounded">more_horiz</span>
                </button>

                {openMenuId === item.id && (
                  <div className="feed-card__dropdown">
                    {isOwnPost(item) && (
                      <>
                        <button
                          className="dropdown-item"
                          onClick={() => handleEdit(item)}
                        >
                          <span className="material-symbols-rounded">edit</span>
                          수정하기
                        </button>
                        <button
                          className="dropdown-item delete"
                          onClick={() => handleDelete(item.id)}
                        >
                          <span className="material-symbols-rounded">
                            delete
                          </span>
                          삭제하기
                        </button>
                      </>
                    )}
                    <button
                      className="dropdown-item report"
                      onClick={() => handleReport(item.id)}
                    >
                      <span className="material-symbols-rounded">flag</span>
                      신고하기
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 음식 관련 피드 */}
            {(item.post_type === "food" || item.food_name || item.foodName) && (
              <div
                className={`feed-card__content ${
                  (item.life_change || item.lifeChange) >= 0 ? "good" : "bad"
                }`}
              >
                <div className="feed-card__main-visual">
                  <span className="food-emoji">
                    {item.image || item.image_url || "🍽️"}
                  </span>
                  {(item.life_change !== null || item.lifeChange !== null) && (
                    <div className="food-score-badge">
                      <span className="label">수명</span>
                      <span className="value">
                        {(item.life_change || item.lifeChange) > 0 ? "+" : ""}
                        {item.life_change || item.lifeChange}일
                      </span>
                    </div>
                  )}
                </div>

                <div className="feed-card__details">
                  <h3 className="food-name">
                    {item.food_name || item.foodName}
                  </h3>
                  <p className="comment">{item.comment}</p>
                  <div className="tags">
                    {(item.tags || []).map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 일반 피드 */}
            {item.post_type === "general" &&
              !item.food_name &&
              !item.foodName && (
                <div className="feed-card__content general">
                  {item.image_url && item.image_url.startsWith("http") && (
                    <div className="feed-card__image">
                      <img src={item.image_url} alt="피드 이미지" />
                    </div>
                  )}
                  <div className="feed-card__details">
                    <p className="comment">{item.comment}</p>
                    <div className="tags">
                      {(item.tags || []).map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            <div className="feed-card__actions">
              <button
                className={`action-btn ${item.isLiked ? "active" : ""}`}
                onClick={() => handleLike(item.id)}
              >
                <span className="material-symbols-rounded">
                  {item.isLiked ? "favorite" : "favorite_border"}
                </span>
                <span className="count">
                  {item.like_count || item.likes || 0}
                </span>
              </button>
              <button
                className="action-btn"
                onClick={() => toggleComments(item.id)}
              >
                <span className="material-symbols-rounded">
                  chat_bubble_outline
                </span>
                <span className="count">{item.comment_count || 0}</span>
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

            {/* 댓글 섹션 */}
            {expandedComments[item.id] && (
              <div className="feed-card__comments">
                {loadingComments[item.id] ? (
                  <div className="comments-loading">댓글 불러오는 중...</div>
                ) : (
                  <>
                    <div className="comments-list">
                      {(commentsData[item.id] || []).map((comment) => (
                        <div key={comment.id} className="comment-item">
                          <div className="comment-avatar">
                            {(comment.user || comment.nickname || "익")[0]}
                          </div>
                          <div className="comment-content">
                            <span className="comment-user">
                              {comment.user || comment.nickname}
                            </span>
                            <span className="comment-text">
                              {comment.content}
                            </span>
                          </div>
                        </div>
                      ))}
                      {(!commentsData[item.id] ||
                        commentsData[item.id].length === 0) && (
                        <div className="comments-empty">
                          첫 댓글을 남겨보세요! 🐷
                        </div>
                      )}
                    </div>
                    <div className="comment-input-wrapper">
                      <input
                        type="text"
                        placeholder="댓글을 입력하세요... (100자)"
                        value={commentInputs[item.id] || ""}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({
                            ...prev,
                            [item.id]: e.target.value.slice(0, 100),
                          }))
                        }
                        maxLength={100}
                        onKeyPress={(e) =>
                          e.key === "Enter" && handleSubmitComment(item.id)
                        }
                      />
                      <span
                        className={`comment-char-count ${
                          (commentInputs[item.id]?.length || 0) >= 100
                            ? "limit"
                            : ""
                        }`}
                      >
                        {commentInputs[item.id]?.length || 0}/100
                      </span>
                      <button
                        className="comment-submit"
                        onClick={() => handleSubmitComment(item.id)}
                      >
                        <span className="material-symbols-rounded">send</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
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
