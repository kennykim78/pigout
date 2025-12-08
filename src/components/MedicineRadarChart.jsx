import React, { useMemo } from 'react';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import './MedicineRadarChart.scss';

// Chart.js 컴포넌트 등록
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

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
  /**
   * 전체 약품에 대한 종합 프로파일 계산 및 정규화 (0-100 스케일)
   */
  const { chartData, chartOptions, detailedData } = useMemo(() => {
    console.log('[MedicineRadarChart] 받은 약품 데이터:', medicines);
    
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

    // 🔹 단계 4: 차트 데이터 생성 (단일 면적)
    const datasets = [
      {
        label: `전체 약품 종합 프로파일 (${totalMedicines}개)`,
        data: [
          c1_normalized,  // C1: 평균 부작용 안전성
          c2_normalized,  // C2: 최대 상호작용 안전성
          c3_normalized,  // C3: 평균 복용 편의성
          c4_normalized,  // C4: 최대 복용 편의성
          100 - c5_normalized  // C5: 약품 관리 용이성 (적을수록 관리 쉬움)
        ],
        borderColor: 'rgba(54, 162, 235, 1)',      // 파란색
        backgroundColor: 'rgba(54, 162, 235, 0.3)', // 파란색 투명
        borderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 3,
      }
    ];

    const data = {
      labels: [
        '평균 부작용 안전성',     // C1 (전체 약품의 부작용 평균)
        '최대 상호작용 안전성',   // C2 (가장 위험한 약품 기준)
        '평균 복용 편의성',       // C3 (전체 약품의 복용 빈도 평균)
        '최대 복용 편의성',       // C4 (가장 불편한 약품 기준)
        '약품 관리 용이성'        // C5 (약품 개수, 적을수록 관리 쉬움)
      ],
      datasets
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: {
              size: 14,
              family: "'Noto Sans KR', sans-serif",
              weight: 'bold'
            },
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle',
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleFont: {
            size: 15,
            family: "'Noto Sans KR', sans-serif",
            weight: 'bold'
          },
          bodyFont: {
            size: 14,
            family: "'Noto Sans KR', sans-serif"
          },
          padding: 15,
          displayColors: true,
          callbacks: {
            label: function(context) {
              const label = context.label;
              const value = context.parsed.r.toFixed(1);
              
              // 원시 데이터 표시
              if (label.includes('평균 부작용')) {
                return `${value}점 (평균 ${avgSideEffectCount.toFixed(1)}개 문구)`;
              } else if (label.includes('최대 상호작용')) {
                return `${value}점 (최대 ${maxInteractionCount}개 위험)`;
              } else if (label.includes('평균 복용')) {
                return `${value}점 (평균 1일 ${avgDailyFrequency.toFixed(1)}회)`;
              } else if (label.includes('최대 복용')) {
                return `${value}점 (최대 1일 ${maxDailyFrequency}회)`;
              } else if (label.includes('관리 용이성')) {
                return `${value}점 (총 ${totalMedicineCount}개 약품)`;
              }
              return `${value}점`;
            },
            footer: function(tooltipItems) {
              const value = tooltipItems[0].parsed.r;
              if (value >= 80) return '✅ 매우 안전/편리';
              if (value >= 60) return '👍 양호';
              if (value >= 40) return '⚠️ 보통';
              return '🚨 주의 필요';
            }
          }
        }
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          beginAtZero: true,
          ticks: {
            stepSize: 20,
            font: {
              size: 12,
              weight: 'bold'
            },
            backdropColor: 'rgba(255, 255, 255, 0.9)',
            callback: function(value) {
              return value;
            }
          },
          pointLabels: {
            font: {
              size: 13,
              family: "'Noto Sans KR', sans-serif",
              weight: 'bold'
            },
            color: '#222',
            padding: 18,
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.15)',
            circular: true,
            lineWidth: 1.5
          },
          angleLines: {
            color: 'rgba(0, 0, 0, 0.15)',
            lineWidth: 1.5
          }
        }
      }
    };

    return { chartData: data, chartOptions: options, detailedData: individualScores };
  }, [medicines]);

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

  console.log('[MedicineRadarChart] 차트 렌더링 시작');

  return (
    <div className="radar-chart-container">
      <div className="chart-header">
        <h3>📊 전체 약품 종합 위험도 프로파일</h3>
        <p className="chart-description">
          복용 중인 {medicines.length}개 약품을 통합 분석한 종합 지표입니다
        </p>
      </div>
      <div className="chart-canvas-wrapper">
        <Radar data={chartData} options={chartOptions} />
      </div>
      <div className="chart-footer">
        <div className="chart-legend-info">
          <p>💡 <strong>5가지 종합 지표 설명</strong> (모두 0-100점, 높을수록 안전/편리)</p>
          <ul className="indicator-list">
            <li>
              <strong>🛡️ 평균 부작용 안전성:</strong> 전체 약품의 부작용 문구 평균
              <span className="raw-value"> (평균 {detailedData.reduce((sum, d) => sum + d.p1_sideEffectCount, 0) / detailedData.length}개)</span>
            </li>
            <li>
              <strong>⚠️ 최대 상호작용 안전성:</strong> 가장 위험한 약품의 상호작용 개수
              <span className="raw-value"> (최대 {Math.max(...detailedData.map(d => d.p2_interactionCount))}개)</span>
            </li>
            <li>
              <strong>💊 평균 복용 편의성:</strong> 전체 약품의 일일 복용 횟수 평균
              <span className="raw-value"> (평균 1일 {(detailedData.reduce((sum, d) => sum + d.p3_dailyFrequency, 0) / detailedData.length).toFixed(1)}회)</span>
            </li>
            <li>
              <strong>🔄 최대 복용 편의성:</strong> 가장 자주 복용하는 약품 기준
              <span className="raw-value"> (최대 1일 {Math.max(...detailedData.map(d => d.p3_dailyFrequency))}회)</span>
            </li>
            <li>
              <strong>📋 약품 관리 용이성:</strong> 총 복용 약품 개수
              <span className="raw-value"> (총 {detailedData.length}개)</span>
            </li>
          </ul>
        </div>

        {/* 개별 약품 상세 정보 테이블 */}
        <div className="medicine-detail-table">
          <h4>📋 개별 약품 상세 정보 (원시 데이터)</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>약품명</th>
                  <th>부작용 문구</th>
                  <th>상호작용 위험</th>
                  <th>1일 복용 횟수</th>
                  <th>시장 진입 연수</th>
                </tr>
              </thead>
              <tbody>
                {detailedData.map((data, index) => (
                  <tr key={index}>
                    <td className="medicine-name">{data.name}</td>
                    <td className={data.p1_sideEffectCount > 10 ? 'warning' : ''}>
                      {data.p1_sideEffectCount}개
                    </td>
                    <td className={data.p2_interactionCount > 8 ? 'warning' : ''}>
                      {data.p2_interactionCount}개
                    </td>
                    <td className={data.p3_dailyFrequency > 3 ? 'warning' : ''}>
                      {data.p3_dailyFrequency}회
                    </td>
                    <td>{data.p4_marketYears}년</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-note">
            ⚠️ <strong>주의:</strong> 노란색 배경은 평균 이상의 위험/불편 요소를 나타냅니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MedicineRadarChart;
