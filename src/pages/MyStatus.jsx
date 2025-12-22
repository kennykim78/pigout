import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyStatus } from '../services/api';
import './MyStatus.scss';

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
      const data = await getMyStatus();
      setStatusData(data);
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordClick = (record) => {
    // Navigate to Result01 with cached data logic (similar to History)
    navigate('/result01', {
      state: {
        foodName: record.foodName,
        score: record.score,
        // Assuming Result01 handles fetching or we pass minimal required
        analysisId: record.id,
        imageUrl: record.imageUrl,
        fromHistory: true,
      }
    });
  };

  if (loading) return <div className="my-status loading">로딩 중...</div>;
  if (!statusData) return <div className="my-status error">데이터를 불러올 수 없습니다.</div>;

  const { totalLifeChangeHours, todayLifeChangeHours, timeline } = statusData;

  // Helper to colorize lifespan change
  const getChangeClass = (val) => {
    if (val > 0) return 'positive';
    if (val < 0) return 'negative';
    return 'neutral';
  };

  const getChangeText = (val) => {
    const absVal = Math.abs(val);
    const sign = val > 0 ? '+' : (val < 0 ? '-' : '');
    return `${sign}${absVal}시간`; // Using hours as unit
  };

  return (
    <div className="my-status">
      {/* 1. Header: Lifespan Stats */}
      <header className="status-header">
        <h1>내 상태</h1>
        <div className="lifespan-card">
          <div className="lifespan-main">
            <span className="label">예상 수명 변화</span>
            <div className={`value ${getChangeClass(totalLifeChangeHours)}`}>
              {getChangeText(totalLifeChangeHours)}
            </div>
            <p className="sub-text">지금까지의 식습관이 미친 영향</p>
          </div>
          
          <div className="lifespan-today">
            <span className="label">오늘의 변화</span>
            <span className={`today-value ${getChangeClass(todayLifeChangeHours)}`}>
              {getChangeText(todayLifeChangeHours)}
            </span>
          </div>
        </div>
        
        {/* Weekly/Monthly History Button */}
        <div className="history-actions">
           {/* Placeholder for future modal logic */}
           <button className="history-btn" onClick={() => alert('월간 통계 기능 준비 중입니다.')}>
             📅 월간 통계 보기
           </button>
        </div>
      </header>

      {/* 2. Timeline */}
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
        </div>
      </div>
    </div>
  );
};

const TimelineGroup = ({ period, records, onItemClick }) => {
  if (!records || records.length === 0) return null;

  return (
    <div className="timeline-group">
      <div className="period-label">{period}</div>
      <div className="records-list">
        {records.map(record => (
          <div key={record.id} className="record-item" onClick={() => onItemClick(record)}>
            <div className="time-badge">{record.time}</div>
            <div className="record-info">
              <span className="food-name">{record.foodName}</span>
              <span className={`life-change ${record.lifeChange >= 0 ? 'pos' : 'neg'}`}>
                {record.lifeChange > 0 ? '+' : ''}{record.lifeChange.toFixed(1)}h
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
