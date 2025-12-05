import React, { useMemo } from 'react';
import './MedicineSchedule.scss';

/**
 * 오전, 오후, 저녁 복용해야 할 약과 간단한 복용방법 표기
 * - 시간대별 약품 분류
 * - 간단한 복용 가이드 제공
 */
const MedicineSchedule = ({ medicines }) => {
  const schedule = useMemo(() => {
    if (!medicines || medicines.length === 0) return { morning: [], afternoon: [], evening: [] };

    const scheduleMap = {
      morning: [],    // 오전 6-12시
      afternoon: [],  // 오후 12-18시
      evening: [],    // 저녁 18-24시
    };

    medicines.forEach(medicine => {
      const useMethod = (medicine.useMethodQesitm || '').toLowerCase();
      
      // 복용 시간 추론
      if (useMethod.includes('아침') || useMethod.includes('아침식사') || useMethod.includes('아침 복용')) {
        scheduleMap.morning.push(medicine);
      } else if (useMethod.includes('저녁') || useMethod.includes('저녁식사')) {
        scheduleMap.evening.push(medicine);
      } else if (useMethod.includes('점심') || useMethod.includes('오후')) {
        scheduleMap.afternoon.push(medicine);
      } else {
        // 기본값: 아침에 배정
        scheduleMap.morning.push(medicine);
      }
    });

    return scheduleMap;
  }, [medicines]);

  const renderScheduleBlock = (timeSlot, label, icon, medicines) => (
    <div className={`schedule-block schedule-${timeSlot}`}>
      <div className="schedule-header">
        <div className="schedule-title">
          <span className="schedule-icon">{icon}</span>
          <span className="schedule-label">{label}</span>
        </div>
        <div className="medicine-count">{medicines.length}개</div>
      </div>
      
      <div className="schedule-content">
        {medicines.length > 0 ? (
          <ul className="medicine-list">
            {medicines.slice(0, 3).map((medicine, idx) => (
              <li key={idx} className="medicine-item">
                <span className="medicine-name">{medicine.itemName}</span>
                <span className="medicine-dosage">
                  {medicine.useMethodQesitm ? medicine.useMethodQesitm.split(',')[0] : '1회 1정'}
                </span>
              </li>
            ))}
            {medicines.length > 3 && (
              <li className="medicine-item more">
                <span className="more-text">외 {medicines.length - 3}개</span>
              </li>
            )}
          </ul>
        ) : (
          <div className="empty-message">등록된 약이 없습니다</div>
        )}
      </div>
    </div>
  );

  const hasAnyMedicines = medicines && medicines.length > 0;

  return (
    <div className="medicine-schedule-container">
      <div className="schedule-header-main">
        <h3>⏰ 복용 시간표</h3>
        <p className="schedule-subtitle">약품을 시간대별로 관리하세요</p>
      </div>

      {!hasAnyMedicines ? (
        <div className="empty-schedule">
          <p>📝 약품을 추가하면 복용 시간표가 표시됩니다</p>
        </div>
      ) : (
        <div className="schedule-grid">
          {renderScheduleBlock('morning', '오전', '🌅', schedule.morning)}
          {renderScheduleBlock('afternoon', '오후', '☀️', schedule.afternoon)}
          {renderScheduleBlock('evening', '저녁', '🌙', schedule.evening)}
        </div>
      )}

      <div className="schedule-guide">
        <p className="guide-text">💡 복용 시간은 약품의 용법용량 기준으로 분류되었습니다</p>
      </div>
    </div>
  );
};

export default MedicineSchedule;
