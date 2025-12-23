import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMyStatus } from "../services/api";
import "./MyStatus.scss";

const MyStatus = () => {
  const navigate = useNavigate();
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await getMyStatus();
      setStatusData(data);

      // 월별 히스토리에서 첫 번째 월 선택
      if (data.monthlyHistory) {
        const months = Object.keys(data.monthlyHistory).sort().reverse();
        if (months.length > 0) {
          setSelectedMonth(months[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordClick = (record) => {
    navigate("/result01", {
      state: {
        foodName: record.foodName,
        score: record.score,
        analysisId: record.id,
        imageUrl: record.imageUrl,
        fromHistory: true,
      },
    });
  };

  // Helper to colorize lifespan change
  const getChangeClass = (val) => {
    if (val > 0) return "positive";
    if (val < 0) return "negative";
    return "neutral";
  };

  const getChangeText = (val) => {
    const absVal = Math.abs(val);
    const sign = val > 0 ? "+" : val < 0 ? "-" : "";
    return `${sign}${absVal}시간`;
  };

  const formatMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split("-");
    return `${year}년 ${parseInt(month)}월`;
  };

  const formatDayLabel = (dayKey) => {
    const parts = dayKey.split("-");
    return `${parseInt(parts[1])}월 ${parseInt(parts[2])}일`;
  };

  if (loading) return <div className="my-status loading">로딩 중...</div>;
  if (!statusData)
    return <div className="my-status error">데이터를 불러올 수 없습니다.</div>;

  const {
    weeklyLifeChangeHours,
    todayLifeChangeHours,
    initialLifeExpectancy,
    timeline,
    monthlyHistory,
  } = statusData;

  const months = monthlyHistory
    ? Object.keys(monthlyHistory).sort().reverse()
    : [];

  return (
    <div className="my-status">
      {/* 1. Header: Lifespan Stats */}
      <header className="status-header">
        <h1>내 상태</h1>
        <div className="lifespan-card">
          <div className="lifespan-main">
            <span className="label">최근 1주일 수명 변화</span>
            <div className={`value ${getChangeClass(weeklyLifeChangeHours)}`}>
              {getChangeText(weeklyLifeChangeHours)}
            </div>
          </div>

          <div className="lifespan-sub">
            <div className="sub-item">
              <span className="sub-label">초기 기대수명</span>
              <span className="sub-value">{initialLifeExpectancy}년</span>
            </div>
            <div className="sub-item">
              <span className="sub-label">오늘 변화</span>
              <span
                className={`sub-value ${getChangeClass(todayLifeChangeHours)}`}
              >
                {getChangeText(todayLifeChangeHours)}
              </span>
            </div>
          </div>
        </div>

        {/* History Button */}
        <div className="history-actions">
          <button className="history-btn" onClick={() => navigate("/history")}>
            📅 히스토리 보기
          </button>
        </div>
      </header>

      {/* 2. Today Timeline */}
      <div className="timeline-section">
        <h2>오늘의 기록</h2>

        <div className="timeline-container">
          {/* Morning */}
          <TimelineGroup
            period="아침"
            records={timeline.morning}
            onItemClick={handleRecordClick}
          />
          {/* Lunch */}
          <TimelineGroup
            period="점심"
            records={timeline.lunch}
            onItemClick={handleRecordClick}
          />
          {/* Dinner */}
          <TimelineGroup
            period="저녁"
            records={timeline.dinner}
            onItemClick={handleRecordClick}
          />
          {/* Snack */}
          <TimelineGroup
            period="간식/야식"
            records={timeline.snack}
            onItemClick={handleRecordClick}
          />
          {!timeline.morning?.length &&
            !timeline.lunch?.length &&
            !timeline.dinner?.length &&
            !timeline.snack?.length && (
              <div className="empty-today">
                <p>오늘 기록이 없습니다</p>
              </div>
            )}
        </div>
      </div>

      {/* 3. Monthly History */}
      {months.length > 0 && (
        <div className="monthly-history-section">
          <h2>월별 히스토리</h2>

          {/* Month Selector */}
          <div className="month-selector">
            {months.map((month) => (
              <button
                key={month}
                className={`month-btn ${
                  selectedMonth === month ? "active" : ""
                }`}
                onClick={() => setSelectedMonth(month)}
              >
                {formatMonthLabel(month)}
              </button>
            ))}
          </div>

          {/* Selected Month Data */}
          {selectedMonth && monthlyHistory[selectedMonth] && (
            <div className="month-content">
              <div className="month-summary">
                <span className="summary-label">월간 수명 변화</span>
                <span
                  className={`summary-value ${getChangeClass(
                    monthlyHistory[selectedMonth].totalLifeChange
                  )}`}
                >
                  {getChangeText(monthlyHistory[selectedMonth].totalLifeChange)}
                </span>
                <span className="summary-count">
                  ({monthlyHistory[selectedMonth].recordCount}개 기록)
                </span>
              </div>

              <div className="days-list">
                {Object.keys(monthlyHistory[selectedMonth].days)
                  .sort()
                  .reverse()
                  .map((dayKey) => {
                    const dayData = monthlyHistory[selectedMonth].days[dayKey];
                    return (
                      <div key={dayKey} className="day-group">
                        <div className="day-header">
                          <span className="day-label">
                            {formatDayLabel(dayKey)}
                          </span>
                          <span
                            className={`day-change ${getChangeClass(
                              dayData.dailyLifeChange
                            )}`}
                          >
                            {getChangeText(dayData.dailyLifeChange)}
                          </span>
                        </div>
                        <div className="day-records">
                          {dayData.records.map((record) => (
                            <div
                              key={record.id}
                              className="day-record-item"
                              onClick={() => handleRecordClick(record)}
                            >
                              <span className="record-time">{record.time}</span>
                              <span className="record-name">
                                {record.foodName}
                              </span>
                              <span
                                className={`record-change ${
                                  record.lifeChange >= 0 ? "pos" : "neg"
                                }`}
                              >
                                {record.lifeChange > 0 ? "+" : ""}
                                {record.lifeChange.toFixed(1)}h
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TimelineGroup = ({ period, records, onItemClick }) => {
  if (!records || records.length === 0) return null;

  return (
    <div className="timeline-group">
      <div className="period-label">{period}</div>
      <div className="records-list">
        {records.map((record) => (
          <div
            key={record.id}
            className="record-item"
            onClick={() => onItemClick(record)}
          >
            <div className="time-badge">{record.time}</div>
            <div className="record-info">
              <span className="food-name">{record.foodName}</span>
              <span
                className={`life-change ${
                  record.lifeChange >= 0 ? "pos" : "neg"
                }`}
              >
                {record.lifeChange > 0 ? "+" : ""}
                {record.lifeChange.toFixed(1)}h
              </span>
            </div>
            <div className="arrow">›</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyStatus;
