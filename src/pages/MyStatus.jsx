import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMyStatus } from "../services/api";
import { getUserProfile, getSelectedDiseases } from "../utils/deviceId";
import "./MyStatus.scss";

const MyStatus = () => {
  const navigate = useNavigate();
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
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

      const data = await getMyStatus(userProfile);
      setStatusData(data);
    } catch (error) {
      console.error("Failed to load status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryItemClick = (item) => {
    if (item.type === "food_analysis") {
      // 음식 분석 클릭 시 Result01로 이동
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

  const getActivityLabel = (type) => {
    const labels = {
      food_analysis: "음식 분석",
      detailed_view: "상세분석",
      medicine_analysis: "약물 상호작용",
      recommendation_view: "오늘의 추천",
    };
    return labels[type] || type;
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
    historyList,
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

      {/* 2. History List */}
      <section className="history-section">
        <h2>활동 히스토리</h2>

        <div className="history-list">
          {historyList && historyList.length > 0 ? (
            historyList.map((dayGroup, idx) => (
              <div key={idx} className="day-group">
                <div className="day-header">
                  <span className="day-date">{formatDate(dayGroup.date)}</span>
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
                  {dayGroup.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
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
                        {item.type !== "food_analysis" && (
                          <span className="item-type">
                            {getActivityLabel(item.type)}
                          </span>
                        )}
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
            ))
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
