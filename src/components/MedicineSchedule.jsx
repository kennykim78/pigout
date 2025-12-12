import React, { useMemo, useState, useEffect } from 'react';
import './MedicineSchedule.scss';

/**
 * 복용 시간표 - 현재 시간대 우선 표시, 태그 형식
 * - 현재 시간에 맞는 시간대 자동 선택
 * - 약품을 태그 형식으로 가로 나열
 * - 이전/다음 버튼으로 시간대 전환
 * - 약품별 복용 시간대 직접 수정 가능
 */
const MedicineSchedule = ({ medicines, onUpdateSchedule }) => {
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
  const [editingMedicine, setEditingMedicine] = useState(null);

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
      // 1순위: qr_code_data에서 AI 분석 결과 확인
      let aiScheduleInfo = null;
      if (medicine.qr_code_data) {
        try {
          const qrData = typeof medicine.qr_code_data === 'string' 
            ? JSON.parse(medicine.qr_code_data) 
            : medicine.qr_code_data;
          aiScheduleInfo = qrData.aiScheduleInfo;
        } catch (err) {
          console.warn('[MedicineSchedule] qr_code_data 파싱 실패:', err);
        }
      }

      // AI 분석 결과가 있으면 우선 사용
      if (aiScheduleInfo && aiScheduleInfo.timeSlots && Array.isArray(aiScheduleInfo.timeSlots)) {
        aiScheduleInfo.timeSlots.forEach((slot) => {
          if (scheduleMap[slot]) {
            scheduleMap[slot].push(medicine);
          }
        });
        console.log(`🕐 [${medicine.itemName || medicine.name}] AI 시간대 적용:`, aiScheduleInfo.timeSlots);
        return;
      }

      // 2순위: 용법용량 문자열 분석
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

  // 약품 복용 시간대 수정 핸들러
  const handleEditSchedule = (medicine) => {
    console.log('[MedicineSchedule] 약품 클릭:', medicine.itemName || medicine.name, 'ID:', medicine.id);
    setEditingMedicine(medicine);
  };

  const handleSaveSchedule = async (medicine, newTimeSlots, dosage) => {
    if (!onUpdateSchedule) {
      console.warn('[MedicineSchedule] onUpdateSchedule 콜백이 없습니다');
      return;
    }

    try {
      // 시간대 배열을 frequency 문자열로 변환
      const frequency = `1일 ${newTimeSlots.length}회`;
      
      await onUpdateSchedule(medicine.id, {
        frequency,
        dosage,
        timeSlots: newTimeSlots, // morning, afternoon, evening 배열
      });
      
      setEditingMedicine(null);
      console.log(`✅ [복용시간표] ${medicine.itemName || medicine.name} 시간대 수정 완료`);
    } catch (error) {
      console.error('[복용시간표] 시간대 수정 실패:', error);
      alert('복용 시간대 수정에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleCancelEdit = () => {
    setEditingMedicine(null);
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
              
              {/* 🆕 시간대별 위험도 표시 */}
              {currentMedicines.length >= 2 && (
                <span className="schedule-risk-indicator schedule-risk-indicator--caution">
                  ⚠️ 주의
                </span>
              )}
            </div>

            <div className="medicine-tags">
              {currentMedicines.length > 0 ? (
                currentMedicines.map((medicine, idx) => (
                  <div 
                    key={idx} 
                    className="medicine-tag medicine-tag--editable" 
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('[클릭됨] 약품:', medicine.itemName || medicine.name);
                      handleEditSchedule(medicine);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="medicine-tag-name">
                      {medicine.itemName || medicine.name || '약품명 미확인'}
                    </span>
                    <span className="medicine-tag-dosage">
                      {getDosage(medicine)}
                    </span>
                    <span className="medicine-tag-edit-icon">✏️</span>
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
        <p className="guide-text">✏️ 약품 태그를 클릭하면 복용 시간을 수정할 수 있습니다</p>
      </div>

      {/* 복용 시간대 수정 모달 */}
      {editingMedicine && (
        <MedicineScheduleEditor
          medicine={editingMedicine}
          timeSlots={timeSlots}
          currentSchedule={schedule}
          onSave={handleSaveSchedule}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
};

// 복용 시간대 수정 모달 컴포넌트
const MedicineScheduleEditor = ({ medicine, timeSlots, currentSchedule, onSave, onCancel }) => {
  // 현재 약품이 어느 시간대에 속해 있는지 파악
  const getCurrentTimeSlots = () => {
    const slots = [];
    Object.keys(currentSchedule).forEach((slotKey) => {
      if (currentSchedule[slotKey].some(m => m.id === medicine.id)) {
        slots.push(slotKey);
      }
    });
    return slots;
  };

  const [selectedSlots, setSelectedSlots] = useState(getCurrentTimeSlots());
  const [dosage, setDosage] = useState(medicine.dosage || '1정');

  const toggleTimeSlot = (slotKey) => {
    setSelectedSlots(prev => {
      if (prev.includes(slotKey)) {
        return prev.filter(s => s !== slotKey);
      } else {
        return [...prev, slotKey];
      }
    });
  };

  const handleSave = () => {
    if (selectedSlots.length === 0) {
      alert('최소 1개 이상의 복용 시간대를 선택해주세요.');
      return;
    }
    onSave(medicine, selectedSlots, dosage);
  };

  return (
    <div className="schedule-editor-overlay" onClick={onCancel}>
      <div className="schedule-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="schedule-editor-header">
          <h3>복용 시간 수정</h3>
          <button className="schedule-editor-close" onClick={onCancel}>✕</button>
        </div>

        <div className="schedule-editor-body">
          <div className="schedule-editor-medicine">
            <strong>{medicine.itemName || medicine.name}</strong>
          </div>

          <div className="schedule-editor-section">
            <label>복용 시간대</label>
            <div className="schedule-editor-slots">
              {timeSlots.map((slot) => (
                <button
                  key={slot.key}
                  className={`schedule-editor-slot ${selectedSlots.includes(slot.key) ? 'selected' : ''}`}
                  onClick={() => toggleTimeSlot(slot.key)}
                >
                  <span className="slot-icon">{slot.icon}</span>
                  <span className="slot-label">{slot.label}</span>
                  <span className="slot-time">{slot.time}</span>
                </button>
              ))}
            </div>
            <p className="schedule-editor-hint">
              💡 선택: 1일 {selectedSlots.length}회 복용
            </p>
          </div>

          <div className="schedule-editor-section">
            <label>1회 복용량</label>
            <input
              type="text"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="예: 1정, 2정, 1캡슐"
              className="schedule-editor-input"
            />
          </div>
        </div>

        <div className="schedule-editor-footer">
          <button className="schedule-editor-btn schedule-editor-btn-cancel" onClick={onCancel}>
            취소
          </button>
          <button className="schedule-editor-btn schedule-editor-btn-save" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default MedicineSchedule;
