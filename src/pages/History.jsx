import './History.scss';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMonthlyReport, getAnalysisHistory } from '../services/api';

const History = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('today'); // 'today' or 'calendar'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [todayRecords, setTodayRecords] = useState([]);
  const [monthlyData, setMonthlyData] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    loadTodayRecords();
  }, [selectedDate]);

  useEffect(() => {
    if (viewMode === 'calendar') {
      loadMonthlyData();
    }
  }, [viewMode, currentMonth]);

  const loadTodayRecords = async () => {
    setIsLoading(true);
    try {
      // API에서 분석 히스토리 가져오기
      const response = await getAnalysisHistory(50, 0);
      console.log('[History] API 응답:', response);
      
      const allRecords = response.data || [];
      
      // 선택된 날짜의 기록만 필터링
      const selectedDateStr = formatDate(selectedDate);
      const filteredRecords = allRecords.filter(record => {
        const recordDate = new Date(record.created_at).toISOString().split('T')[0];
        return recordDate === selectedDateStr;
      });
      
      // 데이터 포맷 변환
      const formattedRecords = filteredRecords.map(record => ({
        id: record.id,
        foodName: record.food_name,
        score: record.score,
        time: new Date(record.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        imageUrl: record.image_url,
        analysis: record.analysis,
        diseases: record.diseases,
        createdAt: record.created_at,
        detailedAnalysis: record.detailed_analysis, // 캐시에서 가져온 상세 분석
      }));
      
      console.log('[History] 오늘 기록:', formattedRecords);
      setTodayRecords(formattedRecords);
    } catch (error) {
      console.error('[History] 데이터 로드 실패:', error);
      setTodayRecords([]);
    } finally {
      setIsLoading(false);
    }
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
    // 이전 검색 결과를 그대로 전달하여 Result01에서 바로 표시
    navigate('/result01', {
      state: {
        foodName: item.foodName,
        score: item.score,
        analysis: item.analysis,
        analysisId: item.id,
        imageUrl: item.imageUrl,
        diseases: item.diseases,
        createdAt: item.createdAt,
        detailedAnalysis: item.detailedAnalysis, // 캐시에서 가져온 상세 분석
        fromHistory: true, // 히스토리에서 온 것임을 표시
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
            {isLoading ? (
              <div className="history__loading">
                <p>로딩 중...</p>
              </div>
            ) : todayRecords.length > 0 ? (
              todayRecords.map((item) => (
                <div 
                  key={item.id} 
                  className="history__record-item"
                  onClick={() => handleItemClick(item)}
                >
                  <div className="history__record-icon">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.foodName} className="history__record-thumbnail" />
                    ) : '🍽️'}
                  </div>
                  <div className="history__record-info">
                    <div className="history__record-name">{item.foodName}</div>
                    <div className="history__record-time">{item.time}</div>
                  </div>
                  <div className={`history__record-score ${item.score >= 70 ? 'history__record-score--good' : item.score >= 40 ? 'history__record-score--warning' : 'history__record-score--bad'}`}>
                    {item.score}점
                  </div>
                </div>
              ))
            ) : (
              <div className="history__empty">
                <p>이 날짜에 기록이 없습니다</p>
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
