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

    console.log('🕐 [MedicineSchedule] 복용시간표 계산 시작, 약품 개수:', medicines.length);

    const scheduleMap = {
      morning: [],    // 오전 6-12시
      afternoon: [],  // 오후 12-18시
      evening: [],    // 저녁 18-24시
    };

    medicines.forEach((medicine, idx) => {
      const useMethod = (medicine.useMethodQesitm || medicine.dosage || medicine.frequency || '').toLowerCase();
      
      console.log(`🕐 [약품 ${idx + 1}] ${medicine.itemName}`);
      console.log('  - useMethodQesitm:', medicine.useMethodQesitm);
      console.log('  - frequency:', medicine.frequency);
      console.log('  - dosage:', medicine.dosage);
      console.log('  - 병합된 텍스트:', useMethod);
      
      // 복용 횟수 파악
      const dailyFrequency = useMethod.match(/1일\s*(\d+)\s*회/) || useMethod.match(/(\d+)\s*회/);
      const timesPerDay = dailyFrequency ? parseInt(dailyFrequency[1]) : 1;
      
      console.log('  - 감지된 복용 횟수:', timesPerDay, '회/일');
      
      // 복용 시간 추론
      const hasMorning = useMethod.includes('아침') || useMethod.includes('기상');
      const hasAfternoon = useMethod.includes('점심') || useMethod.includes('오후');
      const hasEvening = useMethod.includes('저녁') || useMethod.includes('취침');
      
      console.log('  - 시간대 명시:', { 아침: hasMorning, 점심: hasAfternoon, 저녁: hasEvening });
      
      // 시간대가 명시된 경우
      if (hasMorning || hasAfternoon || hasEvening) {
        if (hasMorning) {
          scheduleMap.morning.push(medicine);
          console.log('  → 오전에 배정');
        }
        if (hasAfternoon) {
          scheduleMap.afternoon.push(medicine);
          console.log('  → 오후에 배정');
        }
        if (hasEvening) {
          scheduleMap.evening.push(medicine);
          console.log('  → 저녁에 배정');
        }
      } else {
        // 시간대가 명시되지 않은 경우 → 횟수에 따라 자동 배정
        if (timesPerDay >= 3) {
          // 1일 3회 이상: 오전, 오후, 저녁
          scheduleMap.morning.push(medicine);
          scheduleMap.afternoon.push(medicine);
          scheduleMap.evening.push(medicine);
          console.log('  → 오전, 오후, 저녁에 배정 (1일 3회 이상)');
        } else if (timesPerDay === 2) {
          // 1일 2회: 오전, 저녁
          scheduleMap.morning.push(medicine);
          scheduleMap.evening.push(medicine);
          console.log('  → 오전, 저녁에 배정 (1일 2회)');
        } else {
          // 1일 1회 또는 불명확: 오전
          scheduleMap.morning.push(medicine);
          console.log('  → 오전에만 배정 (1일 1회 또는 불명확)');
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
                <span className="medicine-name">{medicine.itemName || medicine.name || '약품명 미확인'}</span>
                <span className="medicine-dosage">
                  {medicine.useMethodQesitm ? medicine.useMethodQesitm.split(',')[0] : (medicine.dosage || medicine.frequency || '1회 1정')}
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
