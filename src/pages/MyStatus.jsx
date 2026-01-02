import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getMyStatus, getActivityHistory } from "../services/api";
import { getUserProfile, getSelectedDiseases } from "../utils/deviceId";
import { useStatusStore } from "../store/statusStore";
import "./MyStatus.scss";

const MyStatus = () => {
  const navigate = useNavigate();
  const {
    statusData,
    setStatusData,
    historyList,
    setHistoryList,
    appendHistory,
    hasMore,
    setHasMore,
    offset,
    setOffset,
    shouldRefetch,
  } = useStatusStore();

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerRef = useRef(null);
  const LIMIT = 30;

  useEffect(() => {
    // 캐시 만료 시에만 API 호출
    if (shouldRefetch()) {
      loadStatus();
    }
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);

      // 프로필 정보 가져오기
      const profile = getUserProfile();
      const diseases = getSelectedDiseases();

      const userProfile = {
        age: profile?.age,
        gender: profile?.gender,
        diseases: diseases,
      };

      // 상태 데이터와 첫 번째 히스토리 페이지 동시 로드
      const [statusResult, historyResult] = await Promise.all([
        getMyStatus(userProfile),
        getActivityHistory(LIMIT, 0),
      ]);

      setStatusData(statusResult);

      // Ensure historyResult.historyList is an array before setting
      const initialHistory = Array.isArray(historyResult?.historyList)
        ? historyResult.historyList
        : [];
      setHistoryList(initialHistory);

      setHasMore(!!historyResult?.hasMore);
      setOffset(LIMIT);
    } catch (error) {
      console.error("Failed to load status:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreHistory = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const result = await getActivityHistory(LIMIT, offset);

      if (
        result &&
        Array.isArray(result.historyList) &&
        result.historyList.length > 0
      ) {
        // 기존 날짜와 병합 (같은 날짜는 합침)
        setHistoryList((prev) => {
          // Ensure prev is an array
          const currentList = Array.isArray(prev) ? prev : [];
          const merged = [...currentList];

          result.historyList.forEach((newDay) => {
            const existingIdx = merged.findIndex(
              (d) => d && d.date === newDay.date
            );
            if (existingIdx >= 0) {
              // 같은 날짜가 있으면 아이템 추가
              merged[existingIdx] = {
                ...merged[existingIdx],
                items: [
                  ...(Array.isArray(merged[existingIdx].items)
                    ? merged[existingIdx].items
                    : []),
                  ...(Array.isArray(newDay.items) ? newDay.items : []),
                ],
                dailyTotal:
                  (merged[existingIdx].dailyTotal || 0) +
                  (newDay.dailyTotal || 0),
              };
            } else {
              merged.push(newDay);
            }
          });
          return merged;
        });
        setOffset((prev) => prev + LIMIT);
      }

      setHasMore(!!result?.hasMore);
    } catch (error) {
      console.error("Failed to load more history:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [offset, loadingMore, hasMore, setHistoryList, setHasMore, setOffset]);

  // Intersection Observer로 무한 스크롤 구현
  const lastElementRef = useCallback(
    (node) => {
      if (loadingMore) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMoreHistory();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [loadingMore, hasMore, loadMoreHistory]
  );

  const handleHistoryItemClick = (item) => {
    if (item.type === "food_analysis") {
      navigate("/result01", {
        state: {
          foodName: item.name,
          analysisId: item.referenceId,
          imageUrl: item.imageUrl,
          fromHistory: true,
        },
      });
    }
  };

  const getActivityIcon = (type) => {
    const icons = {
      food_analysis: "🍽️",
      detailed_view: "🔍",
      medicine_analysis: "💊",
      recommendation_view: "💡",
    };
    return icons[type] || "📊";
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split("T")[0]) return "오늘";
    if (dateStr === yesterday.toISOString().split("T")[0]) return "어제";

    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일`;
  };

  if (loading) return <div className="my-status loading">로딩 중...</div>;
  if (!statusData)
    return <div className="my-status error">데이터를 불러올 수 없습니다.</div>;

  const {
    totalLifeChangeDays,
    todayLifeChangeDays,
    initialLifeExpectancy,
    currentLifeExpectancy,
    wittyMessage,
  } = statusData;

  return (
    <div className="my-status">
      {/* 1. Header: Main Life Stats Card */}
      <header className="status-header">
        <h1>내 상태</h1>

        <div className="life-card">
          {/* 총 수명변화 (메인) */}
          <div className="life-main">
            <span className="life-label">총 수명 변화</span>
            <div
              className={`life-value ${
                totalLifeChangeDays >= 0 ? "positive" : "negative"
              }`}
            >
              {totalLifeChangeDays > 0 ? "+" : ""}
              {totalLifeChangeDays}일
            </div>
          </div>

          {/* 3개 지표 */}
          <div className="life-metrics">
            <div className="metric-item">
              <span className="metric-label">초기 기대수명</span>
              <span className="metric-value">{initialLifeExpectancy}세</span>
            </div>
            <div className="metric-divider"></div>
            <div className="metric-item">
              <span className="metric-label">현재 기대수명</span>
              <span
                className={`metric-value ${
                  currentLifeExpectancy >= initialLifeExpectancy ? "up" : "down"
                }`}
              >
                {currentLifeExpectancy}세
              </span>
            </div>
            <div className="metric-divider"></div>
            <div className="metric-item">
              <span className="metric-label">오늘 변화</span>
              <span
                className={`metric-value ${
                  todayLifeChangeDays >= 0 ? "up" : "down"
                }`}
              >
                {todayLifeChangeDays > 0 ? "+" : ""}
                {todayLifeChangeDays}일
              </span>
            </div>
          </div>

          {/* 위트 문구 */}
          <div className="witty-message">{wittyMessage}</div>
        </div>
      </header>

      {/* 2. History List with Infinite Scroll */}
      <section className="history-section">
        <h2>활동 히스토리</h2>

        <div className="history-list">
          {Array.isArray(historyList) && historyList.length > 0 ? (
            <>
              {historyList.map((dayGroup, idx) => (
                <div
                  key={dayGroup?.date || idx}
                  className="day-group"
                  ref={idx === historyList.length - 1 ? lastElementRef : null}
                >
                  <div className="day-header">
                    <span className="day-date">
                      {formatDate(dayGroup.date)}
                    </span>
                    <span
                      className={`day-total ${
                        dayGroup.dailyTotal >= 0 ? "positive" : "negative"
                      }`}
                    >
                      {dayGroup.dailyTotal > 0 ? "+" : ""}
                      {dayGroup.dailyTotal.toFixed(0)}일
                    </span>
                  </div>

                  <div className="day-items">
                    {Array.isArray(dayGroup?.items) &&
                      dayGroup.items.map((item, itemIdx) => (
                        <div
                          key={`${item.id}-${itemIdx}`}
                          className={`history-item ${
                            item.type === "food_analysis" ? "clickable" : ""
                          }`}
                          onClick={() => handleHistoryItemClick(item)}
                        >
                          <span className="item-icon">
                            {getActivityIcon(item.type)}
                          </span>
                          <div className="item-info">
                            <span className="item-time">{item.time}</span>
                            <span className="item-name">{item.name}</span>
                          </div>
                          <span
                            className={`item-change ${
                              item.lifeChangeDays >= 0 ? "positive" : "negative"
                            }`}
                          >
                            {item.lifeChangeDays > 0 ? "+" : ""}
                            {item.lifeChangeDays}일
                          </span>
                          {item.type === "food_analysis" && (
                            <span className="item-arrow">›</span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}

              {loadingMore && (
                <div className="loading-more">
                  <div className="spinner-small"></div>
                  <span>더 불러오는 중...</span>
                </div>
              )}

              {!hasMore && historyList.length > 5 && (
                <div className="no-more">모든 기록을 불러왔습니다</div>
              )}
            </>
          ) : (
            <div className="empty-history">
              <p>아직 기록이 없습니다</p>
              <p className="empty-hint">
                음식을 분석하면 여기에 기록이 표시됩니다
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default MyStatus;
