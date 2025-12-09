import React, { useMemo, useState, useEffect } from 'react';
import './MedicineSchedule.scss';

/**
 * 복용 시간표 - 현재 시간대 우선 표시, 태그 형식
 * - 현재 시간에 맞는 시간대 자동 선택
 * - 약품을 태그 형식으로 가로 나열
 * - 이전/다음 버튼으로 시간대 전환
 */
const MedicineSchedule = ({ medicines }) => {
  const timeSlots = [
    { key: 'morning', label: '아침', icon: '🌅', time: '06:00 - 12:00' },
    { key: 'afternoon', label: '점심', icon: '☀️', time: '12:00 - 18:00' },
    { key: 'evening', label: '저녁', icon: '🌙', time: '18:00 - 24:00' },
  ];

  // 현재 시간에 맞는 시간대 자동 선택
  const getCurrentTimeSlot = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 0; // 아침
    if (hour >= 12 && hour < 18) return 1; // 점심
    return 2; // 저녁
  };

  const [currentSlotIndex, setCurrentSlotIndex] = useState(getCurrentTimeSlot());

  // 시간대별 약품 분류
  const schedule = useMemo(() => {
    if (!medicines || medicines.length === 0) return { morning: [], afternoon: [], evening: [] };

    console.log('🕐 [MedicineSchedule] 복용시간표 계산 시작, 약품 개수:', medicines.length);

    const scheduleMap = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    medicines.forEach((medicine, idx) => {
      const useMethod = (medicine.useMethodQesitm || medicine.dosage || medicine.frequency || '').toLowerCase();
      
      // 복용 횟수 파악
      let timesPerDay = 2; // 기본값: 1일 2회
      
      if (useMethod) {
        const dailyFrequency = useMethod.match(/1일\s*(\d+)\s*회/) || useMethod.match(/(\d+)\s*회/);
        if (dailyFrequency) {
          timesPerDay = parseInt(dailyFrequency[1]);
        }
      }
      
      // 복용 시간 추론
      const hasMorning = useMethod.includes('아침') || useMethod.includes('기상');
      const hasAfternoon = useMethod.includes('점심') || useMethod.includes('오후');
      const hasEvening = useMethod.includes('저녁') || useMethod.includes('취침');
      
      // 시간대가 명시된 경우
      if (hasMorning || hasAfternoon || hasEvening) {
        if (hasMorning) scheduleMap.morning.push(medicine);
        if (hasAfternoon) scheduleMap.afternoon.push(medicine);
        if (hasEvening) scheduleMap.evening.push(medicine);
      } else {
        // 시간대가 명시되지 않은 경우 → 횟수에 따라 자동 배정
        if (timesPerDay >= 3) {
          scheduleMap.morning.push(medicine);
          scheduleMap.afternoon.push(medicine);
          scheduleMap.evening.push(medicine);
        } else if (timesPerDay === 2) {
          scheduleMap.morning.push(medicine);
          scheduleMap.evening.push(medicine);
        } else {
          scheduleMap.morning.push(medicine);
        }
      }
    });

    console.log('🕐 [MedicineSchedule] 최종 시간표:', {
      오전: scheduleMap.morning.length + '개',
      오후: scheduleMap.afternoon.length + '개',
      저녁: scheduleMap.evening.length + '개'
    });

    return scheduleMap;
  }, [medicines]);

  const currentSlot = timeSlots[currentSlotIndex];
  const currentMedicines = schedule[currentSlot.key];

  const handlePrevSlot = () => {
    setCurrentSlotIndex((prev) => (prev === 0 ? timeSlots.length - 1 : prev - 1));
  };

  const handleNextSlot = () => {
    setCurrentSlotIndex((prev) => (prev === timeSlots.length - 1 ? 0 : prev + 1));
  };

  // 용량 추출 함수
  const getDosage = (medicine) => {
    const useMethod = medicine.useMethodQesitm || medicine.dosage || '';
    
    // "1회 1정", "1정씩" 등에서 정 추출
    const dosageMatch = useMethod.match(/(\d+)\s*정/) || useMethod.match(/(\d+)\s*회/);
    if (dosageMatch) {
      return `${dosageMatch[1]}정`;
    }
    
    return '1정'; // 기본값
  };

  const hasAnyMedicines = medicines && medicines.length > 0;

  return (
    <div className="medicine-schedule-container">
      <div className="schedule-header-main">
        <h3>⏰ 복용 시간표</h3>
        <p className="schedule-subtitle">현재 시간대에 복용할 약을 확인하세요</p>
      </div>

      {!hasAnyMedicines ? (
        <div className="empty-schedule">
          <p>📝 약품을 추가하면 복용 시간표가 표시됩니다</p>
        </div>
      ) : (
        <div className="schedule-slider">
          <button 
            className="schedule-nav-btn schedule-nav-prev" 
            onClick={handlePrevSlot}
            aria-label="이전 시간대"
          >
            ‹
          </button>

          <div className="schedule-current">
            <div className="schedule-time-header">
              <span className="schedule-icon">{currentSlot.icon}</span>
              <div className="schedule-time-info">
                <h4 className="schedule-label">{currentSlot.label}</h4>
                <p className="schedule-time">{currentSlot.time}</p>
              </div>
              <span className="medicine-count">{currentMedicines.length}개</span>
            </div>

            <div className="medicine-tags">
              {currentMedicines.length > 0 ? (
                currentMedicines.map((medicine, idx) => (
                  <div key={idx} className="medicine-tag">
                    <span className="medicine-tag-name">
                      {medicine.itemName || medicine.name || '약품명 미확인'}
                    </span>
                    <span className="medicine-tag-dosage">
                      {getDosage(medicine)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty-message">이 시간대에 복용할 약이 없습니다</div>
              )}
            </div>
          </div>

          <button 
            className="schedule-nav-btn schedule-nav-next" 
            onClick={handleNextSlot}
            aria-label="다음 시간대"
          >
            ›
          </button>
        </div>
      )}

      <div className="schedule-indicators">
        {timeSlots.map((slot, index) => (
          <button
            key={slot.key}
            className={`schedule-indicator ${index === currentSlotIndex ? 'active' : ''}`}
            onClick={() => setCurrentSlotIndex(index)}
            aria-label={`${slot.label} 시간대로 이동`}
          >
            <span className="indicator-icon">{slot.icon}</span>
            <span className="indicator-label">{slot.label}</span>
          </button>
        ))}
      </div>

      <div className="schedule-guide">
        <p className="guide-text">💡 복용 시간은 약품의 용법용량 기준으로 분류되었습니다</p>
      </div>
    </div>
  );
};

export default MedicineSchedule;
