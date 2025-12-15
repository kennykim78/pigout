import React, { useMemo } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import './MedicineRadarChart.scss';

/**
 * 다수 약품 복용자를 위한 종합 위험도 방사형 그래프
 * 
 * 🎯 목적: 6개 이상 약품 복용 시 전체적인 위험도를 단일 프로파일로 시각화
 * 
 * 5가지 종합 지표 (C1~C5):
 * C1. 평균 부작용 위험도 (전체 약품의 부작용 평균)
 * C2. 최대 상호작용 위험 개수 (가장 위험한 약품 기준)
 * C3. 평균 일일 투여량 (전체 약품의 복용 빈도 평균)
 * C4. 최대 복용 빈도 (가장 자주 복용하는 약품 기준)
 * C5. 총 복용 약품 개수 (독립적인 축으로 활용)
 */
const MedicineRadarChart = ({ medicines }) => {
  console.log('🔴🔴🔴 [MedicineRadarChart] 컴포넌트 렌더링 시작! medicines:', medicines);
  console.log('🔴🔴🔴 [MedicineRadarChart] medicines 타입:', typeof medicines);
  console.log('🔴🔴🔴 [MedicineRadarChart] medicines 배열 여부:', Array.isArray(medicines));
  console.log('🔴🔴🔴 [MedicineRadarChart] medicines 길이:', medicines?.length);

  // 🆘 에러 발생 시 명확히 표시
  if (!medicines) {
    console.error('🔴🔴🔴 [MedicineRadarChart] medicines가 undefined/null입니다!');
    return <div className="radar-chart-container empty"><p className="empty-message">❌ 데이터 로드 실패</p></div>;
  }

  if (!Array.isArray(medicines)) {
    console.error('🔴🔴🔴 [MedicineRadarChart] medicines가 배열이 아닙니다! 타입:', typeof medicines);
    return <div className="radar-chart-container empty"><p className="empty-message">❌ 잘못된 데이터 형식</p></div>;
  }
  
  /**
   * 전체 약품에 대한 종합 프로파일 계산 및 정규화 (0-100 스케일)
   */
  let chartData, chartOptions, detailedData;
  
  try {
    const result = useMemo(() => {
      console.log('[MedicineRadarChart] useMemo 실행 시작! 받은 약품 데이터:', medicines);
    
    if (!medicines || medicines.length === 0) {
      console.log('[MedicineRadarChart] 약품 없음 → 빈 차트');
      return { chartData: null, chartOptions: null, detailedData: [] };
    }
    
    console.log('[MedicineRadarChart] 약품 개수:', medicines.length);
    console.log('[MedicineRadarChart] 첫 번째 약품 필드:', medicines[0] ? Object.keys(medicines[0]) : 'No data');

    /**
     * P1. 개별 약품의 부작용 위험도 계산 (원시 점수)
     * - 부작용 문구 개수 기반 (0-20개 범위)
     * - 낮을수록 안전
     */
    const calculateSideEffectCount = (medicine) => {
      const seQesitm = medicine.seQesitm || '';
      const atpnWarnQesitm = medicine.atpnWarnQesitm || '';
      
      if (!seQesitm && !atpnWarnQesitm) return 5; // 정보 없으면 중간값
      
      const sideEffectCount = (seQesitm + atpnWarnQesitm).split(/[,.\n]/g).filter(s => s.trim()).length;
      return Math.min(sideEffectCount, 20); // 최대 20개로 제한
    };

    /**
     * P2. 개별 약품의 상호작용 위험 개수 (원시 점수)
     * - DUR 정보나 상호작용 문구 개수 기반 (0-15개 범위)
     * - 낮을수록 안전
     */
    const calculateInteractionCount = (medicine) => {
      const intrcQesitm = medicine.intrcQesitm || '';
      const atpnQesitm = medicine.atpnQesitm || '';
      
      if (!intrcQesitm && !atpnQesitm) return 3; // 정보 없으면 중간값
      
      const interactionCount = (intrcQesitm + atpnQesitm).split(/[,.\n]/g).filter(s => s.trim()).length;
      return Math.min(interactionCount, 15); // 최대 15개로 제한
    };

    /**
     * P3. 개별 약품의 일일 복용 빈도 (원시 점수)
     * - 1일 N회 형태로 추출 (1-6회 범위)
     * - 낮을수록 편리
     */
    const calculateDailyFrequency = (medicine) => {
      const useMethod = medicine.useMethodQesitm || '';
      
      if (!useMethod) return 2; // 정보 없으면 기본 2회
      
      // 복용 빈도 추출 (1일 N회)
      const frequencyMatch = useMethod.match(/1일\s*(\d+)\s*회/);
      const dailyFreq = frequencyMatch ? parseInt(frequencyMatch[1]) : 2;
      
      return Math.min(dailyFreq, 6); // 최대 6회로 제한
    };

    /**
     * P4. 개별 약품의 시장 진입 연수 (원시 점수)
     * - 허가일자 기반 (0-30년 범위)
     * - 높을수록 검증됨
     */
    const calculateMarketYears = (medicine) => {
      const itemSeq = medicine.itemSeq || '';
      const yearMatch = itemSeq.match(/^(\d{4})/);
      
      if (!yearMatch) return 10; // 정보 없으면 기본 10년
      
      const approvalYear = parseInt(yearMatch[1]);
      const currentYear = new Date().getFullYear();
      const yearsInMarket = currentYear - approvalYear;
      
      return Math.max(0, Math.min(yearsInMarket, 30)); // 0-30년 범위
    };

    // 🔹 단계 1: 각 약품별 개별 지표 계산 (P1~P4)
    const individualScores = medicines.map(medicine => {
      const p1_sideEffectCount = calculateSideEffectCount(medicine);
      const p2_interactionCount = calculateInteractionCount(medicine);
      const p3_dailyFrequency = calculateDailyFrequency(medicine);
      const p4_marketYears = calculateMarketYears(medicine);

      return {
        name: medicine.itemName || medicine.name || '약품명 미확인',
        p1_sideEffectCount,
        p2_interactionCount,
        p3_dailyFrequency,
        p4_marketYears,
        medicine // 원본 데이터 보관 (테이블용)
      };
    });

    console.log('[종합 프로파일] 개별 약품 원시 점수:', individualScores);

    // 🔹 단계 2: 종합 프로파일 계산 (C1~C5)
    const totalMedicines = individualScores.length;

    // C1. 평균 부작용 위험도 (P1의 평균)
    const avgSideEffectCount = individualScores.reduce((sum, s) => sum + s.p1_sideEffectCount, 0) / totalMedicines;

    // C2. 최대 상호작용 위험 개수 (P2의 최대값)
    const maxInteractionCount = Math.max(...individualScores.map(s => s.p2_interactionCount));

    // C3. 평균 일일 복용 빈도 (P3의 평균)
    const avgDailyFrequency = individualScores.reduce((sum, s) => sum + s.p3_dailyFrequency, 0) / totalMedicines;

    // C4. 최대 복용 빈도 (P3의 최대값)
    const maxDailyFrequency = Math.max(...individualScores.map(s => s.p3_dailyFrequency));

    // C5. 총 복용 약품 개수
    const totalMedicineCount = totalMedicines;

    console.log('[종합 프로파일] 원시 종합 지표:', {
      C1_평균부작용위험도: avgSideEffectCount.toFixed(2),
      C2_최대상호작용위험: maxInteractionCount,
      C3_평균일일복용빈도: avgDailyFrequency.toFixed(2),
      C4_최대복용빈도: maxDailyFrequency,
      C5_총약품개수: totalMedicineCount
    });

    // 🔹 단계 3: 정규화 (0-100 스케일로 변환, Min-Max Scaling)
    // C1: 평균 부작용 위험도 (0-20개 → 100-0점, 역정규화)
    const c1_normalized = Math.max(0, 100 - (avgSideEffectCount / 20) * 100);

    // C2: 최대 상호작용 위험 (0-15개 → 100-0점, 역정규화)
    const c2_normalized = Math.max(0, 100 - (maxInteractionCount / 15) * 100);

    // C3: 평균 일일 복용 빈도 (1-6회 → 100-0점, 역정규화)
    const c3_normalized = Math.max(0, 100 - ((avgDailyFrequency - 1) / 5) * 100);

    // C4: 최대 복용 빈도 (1-6회 → 100-0점, 역정규화)
    const c4_normalized = Math.max(0, 100 - ((maxDailyFrequency - 1) / 5) * 100);

    // C5: 총 약품 개수 (1-10개 → 0-100점, 정정규화, 많을수록 관리 부담 증가)
    const c5_normalized = Math.min(100, ((totalMedicineCount - 1) / 9) * 100);

    console.log('[종합 프로파일] 정규화 점수 (0-100):', {
      C1_평균부작용안전성: c1_normalized.toFixed(1),
      C2_최대상호작용안전성: c2_normalized.toFixed(1),
      C3_평균복용편의성: c3_normalized.toFixed(1),
      C4_최대복용편의성: c4_normalized.toFixed(1),
      C5_관리부담도: c5_normalized.toFixed(1)
    });

    // 🔹 단계 4: Recharts용 데이터 포맷 변환
    const radarData = [
      { 
        subject: '평균 부작용\n안전성', 
        value: c1_normalized,
        fullMark: 100,
        rawValue: `평균 ${avgSideEffectCount.toFixed(1)}개 문구`,
        category: 'C1'
      },
      { 
        subject: '최대 상호작용\n안전성', 
        value: c2_normalized,
        fullMark: 100,
        rawValue: `최대 ${maxInteractionCount}개 위험`,
        category: 'C2'
      },
      { 
        subject: '평균 복용\n편의성', 
        value: c3_normalized,
        fullMark: 100,
        rawValue: `평균 1일 ${avgDailyFrequency.toFixed(1)}회`,
        category: 'C3'
      },
      { 
        subject: '최대 복용\n편의성', 
        value: c4_normalized,
        fullMark: 100,
        rawValue: `최대 1일 ${maxDailyFrequency}회`,
        category: 'C4'
      },
      { 
        subject: '약품 관리\n용이성', 
        value: 100 - c5_normalized,
        fullMark: 100,
        rawValue: `총 ${totalMedicineCount}개 약품`,
        category: 'C5'
      }
    ];

    return { chartData: radarData, chartOptions: null, detailedData: individualScores };
    }, [medicines]);
    
    chartData = result.chartData;
    chartOptions = result.chartOptions;
    detailedData = result.detailedData;
  } catch (error) {
    console.error('🔴🔴🔴 [MedicineRadarChart] useMemo 실행 중 에러 발생:', error);
    console.error('🔴🔴🔴 [MedicineRadarChart] 에러 스택:', error.stack);
    return (
      <div className="radar-chart-container empty">
        <p className="empty-message">❌ 차트 계산 중 오류 발생: {error.message}</p>
      </div>
    );
  }

  console.log('[MedicineRadarChart] useMemo 완료 - chartData:', chartData ? '존재' : '없음');
  console.log('[MedicineRadarChart] detailedData:', detailedData);

  if (!chartData) {
    console.log('[MedicineRadarChart] chartData 없음 → 빈 메시지 표시');
    return (
      <div className="radar-chart-container empty">
        <p className="empty-message">📊 약품을 추가하면 안전성/편의성 비교 그래프가 표시됩니다</p>
      </div>
    );
  }

  console.log('[MedicineRadarChart] 차트 렌더링 시작 - Recharts 사용');

  // Custom Tooltip for Recharts
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const value = data.value.toFixed(1);
      
      let status = '🚨 주의 필요';
      if (value >= 80) status = '✅ 매우 안전/편리';
      else if (value >= 60) status = '👍 양호';
      else if (value >= 40) status = '⚠️ 보통';
      
      return (
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: "'Noto Sans KR', sans-serif"
        }}>
          <p style={{ margin: '0 0 6px', fontWeight: 'bold', fontSize: '15px' }}>
            {data.subject.replace('\n', ' ')}
          </p>
          <p style={{ margin: '0 0 6px' }}>
            {value}점 ({data.rawValue})
          </p>
          <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>
            {status}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="radar-chart-container">
      <div className="chart-header">
        <h3>📊 전체 약품 종합 위험도 프로파일</h3>
        <p className="chart-description">
          복용 중인 {medicines.length}개 약품을 통합 분석한 종합 지표입니다
        </p>
      </div>
      <div className="chart-canvas-wrapper" style={{ width: '100%', height: '350px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData}>
            <PolarGrid stroke="rgba(0, 0, 0, 0.15)" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ 
                fill: '#222', 
                fontSize: 11, 
                fontWeight: 600,
                fontFamily: "'Noto Sans KR', sans-serif"
              }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 100]} 
              tick={{ fontSize: 10, fontWeight: 600 }}
              tickCount={5}
            />
            <Radar
              name={`전체 약품 종합 프로파일 (${medicines.length}개)`}
              dataKey="value"
              stroke="#3498db"
              fill="#3498db"
              fillOpacity={0.4}
              strokeWidth={3}
              dot={{ fill: '#3498db', r: 5 }}
              activeDot={{ fill: '#3498db', r: 7 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{
                paddingTop: '20px',
                fontFamily: "'Noto Sans KR', sans-serif",
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-footer">
        <div className="chart-summary">
          <p className="summary-text">
            {(() => {
              // 전체 평균 점수 계산
              const avgScore = chartData.reduce((sum, item) => sum + item.value, 0) / chartData.length;
              
              // 가장 낮은 점수의 지표 찾기
              const lowestItem = chartData.reduce((min, item) => item.value < min.value ? item : min);
              
              if (avgScore >= 70) {
                return `✅ 전반적으로 안전하고 편리합니다. 현재 복용 방식을 유지하세요.`;
              } else if (avgScore >= 50) {
                return `⚠️ ${lowestItem.subject.replace('\n', ' ')}에 주의가 필요합니다.`;
              } else {
                return `🚨 ${lowestItem.subject.replace('\n', ' ')} 개선을 권장합니다. 의사와 상담하세요.`;
              }
            })()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MedicineRadarChart;
