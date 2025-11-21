import './History.scss';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMonthlyReport } from '../services/api';

const History = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('today'); // 'today' or 'calendar'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [todayRecords, setTodayRecords] = useState([]);
  const [monthlyData, setMonthlyData] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  useEffect(() => {
    loadTodayRecords();
  }, [selectedDate]);

  useEffect(() => {
    if (viewMode === 'calendar') {
      loadMonthlyData();
    }
  }, [viewMode, currentMonth]);

  const loadTodayRecords = () => {
    // TODO: API에서 실제 데이터 가져오기
    const mockRecords = [
      { id: 1, foodName: '김치찌개', score: 75, time: '12:30', imageUrl: null },
      { id: 2, foodName: '비빔밥', score: 85, time: '18:20', imageUrl: null },
      { id: 3, foodName: '삼겹살', score: 60, time: '19:15', imageUrl: null },
    ];
    setTodayRecords(mockRecords);
  };

  const loadMonthlyData = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const data = await getMonthlyReport(year, month);
      
      // dailyRecords를 날짜별로 매핑
      const dataByDate = {};
      if (data.dailyRecords) {
        data.dailyRecords.forEach(record => {
          const dateKey = record.date;
          dataByDate[dateKey] = {
            count: (record.food_count || 0) + (record.combined_count || 0),
            avgScore: Math.round(
              ((record.food_total_score || 0) + 
               (record.combined_count || 0) * (record.combined_avg_score || 0)) / 
              ((record.food_count || 0) + (record.combined_count || 0) || 1)
            )
          };
        });
      }
      setMonthlyData(dataByDate);
    } catch (error) {
      console.error('Failed to load monthly data:', error);
      setMonthlyData({});
    }
  };

  const handleItemClick = (item) => {
    navigate('/result01', {
      state: {
        foodName: item.foodName,
        score: item.score,
        analysisId: item.id
      }
    });
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setViewMode('today');
    // 해당 날짜 데이터 로드
    loadTodayRecords();
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // 이전 달의 빈 칸
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // 현재 달의 날짜
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  const formatDate = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="history">
      <div className="history__header">
        <button className="history__back-button" onClick={() => navigate(-1)}>
          ←
        </button>
        <h1 className="history__title">히스토리</h1>
        <button 
          className="history__view-toggle"
          onClick={() => setViewMode(viewMode === 'today' ? 'calendar' : 'today')}
        >
          {viewMode === 'today' ? '📅' : '📋'}
        </button>
      </div>

      {viewMode === 'today' ? (
        <div className="history__today-view">
          <div className="history__date-header">
            <h2>{selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일</h2>
            <span className="history__weekday">
              {['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][selectedDate.getDay()]}
            </span>
          </div>

          <div className="history__records-list">
            {todayRecords.length > 0 ? (
              todayRecords.map((item) => (
                <div 
                  key={item.id} 
                  className="history__record-item"
                  onClick={() => handleItemClick(item)}
                >
                  <div className="history__record-icon">🍽️</div>
                  <div className="history__record-info">
                    <div className="history__record-name">{item.foodName}</div>
                    <div className="history__record-time">{item.time}</div>
                  </div>
                  <div className="history__record-score">{item.score}점</div>
                </div>
              ))
            ) : (
              <div className="history__empty">
                <p>오늘 기록이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="history__calendar-view">
          <div className="history__calendar-header">
            <button className="history__month-nav" onClick={handlePrevMonth}>‹</button>
            <h2 className="history__month-title">
              {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
            </h2>
            <button className="history__month-nav" onClick={handleNextMonth}>›</button>
          </div>

          <div className="history__calendar">
            <div className="history__calendar-weekdays">
              {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                <div key={day} className="history__weekday-label">{day}</div>
              ))}
            </div>
            <div className="history__calendar-days">
              {getDaysInMonth(currentMonth).map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="history__calendar-day history__calendar-day--empty" />;
                }
                
                const dateKey = formatDate(date);
                const hasRecords = monthlyData[dateKey];
                const isToday = formatDate(date) === formatDate(new Date());
                
                return (
                  <div 
                    key={index} 
                    className={`history__calendar-day ${hasRecords ? 'history__calendar-day--has-records' : ''} ${isToday ? 'history__calendar-day--today' : ''}`}
                    onClick={() => hasRecords && handleDateClick(date)}
                  >
                    <span className="history__day-number">{date.getDate()}</span>
                    {hasRecords && (
                      <span className="history__day-count">{hasRecords.count}개</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
