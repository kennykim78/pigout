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
 * 의약품 안전성/복용 편의성 비교 방사형 그래프
 * 
 * 5가지 핵심 지표:
 * P1. 부작용 위험도 (낮을수록 안전)
 * P2. 상호작용 위험 (낮을수록 안전)
 * P3. 복용 편의성 (높을수록 좋음)
 * P4. 안전성 점수 (높을수록 안전)
 * P5. 신뢰도 (높을수록 신뢰)
 */
const MedicineRadarChart = ({ medicines }) => {
  /**
   * 약품별 정량적 지표 계산 및 정규화 (0-100 스케일)
   */
  const { chartData, chartOptions } = useMemo(() => {
    if (!medicines || medicines.length === 0) {
      return { chartData: null, chartOptions: null };
    }

    // 최대 3개 약품만 비교 (가독성 유지)
    const topMedicines = medicines.slice(0, 3);

    /**
     * P1. 부작용 위험도 계산
     * - 부작용 문구 개수 기반
     * - 정규화: 많을수록 낮은 점수 (역정규화)
     */
    const calculateSideEffectRisk = (medicine) => {
      const seQesitm = medicine.seQesitm || '';
      const atpnWarnQesitm = medicine.atpnWarnQesitm || '';
      const sideEffectCount = (seQesitm + atpnWarnQesitm).split(/[,.\n]/g).filter(s => s.trim()).length;
      
      // 0-20개 범위를 0-100 역정규화 (부작용 많으면 낮은 점수)
      return Math.max(0, 100 - Math.min(sideEffectCount * 5, 100));
    };

    /**
     * P2. 상호작용 위험 계산
     * - DUR 정보나 상호작용 문구 개수 기반
     * - 정규화: 많을수록 낮은 점수 (역정규화)
     */
    const calculateInteractionRisk = (medicine) => {
      const intrcQesitm = medicine.intrcQesitm || '';
      const atpnQesitm = medicine.atpnQesitm || '';
      const interactionCount = (intrcQesitm + atpnQesitm).split(/[,.\n]/g).filter(s => s.trim()).length;
      
      // 0-15개 범위를 0-100 역정규화
      return Math.max(0, 100 - Math.min(interactionCount * 7, 100));
    };

    /**
     * P3. 복용 편의성 계산
     * - 복용 빈도가 적을수록 높은 점수
     * - 1일 1회 = 100점, 1일 4회 이상 = 0점
     */
    const calculateConvenience = (medicine) => {
      const useMethod = medicine.useMethodQesitm || '';
      
      // 복용 빈도 추출 (1일 N회)
      const frequencyMatch = useMethod.match(/1일\s*(\d+)\s*회/);
      const dailyFreq = frequencyMatch ? parseInt(frequencyMatch[1]) : 2; // 기본 2회
      
      // 1회=100, 2회=75, 3회=50, 4회 이상=25
      if (dailyFreq === 1) return 100;
      if (dailyFreq === 2) return 75;
      if (dailyFreq === 3) return 50;
      return 25;
    };

    /**
     * P4. 안전성 점수 계산
     * - 허가일자 기반 (오래된 약일수록 검증됨)
     * - 전문의약품 여부
     */
    const calculateSafety = (medicine) => {
      let score = 50; // 기본 점수
      
      // 시장 진입 연수 (오래될수록 높은 점수)
      const itemSeq = medicine.itemSeq || '';
      const yearMatch = itemSeq.match(/^(\d{4})/);
      if (yearMatch) {
        const approvalYear = parseInt(yearMatch[1]);
        const yearsInMarket = 2025 - approvalYear;
        score += Math.min(yearsInMarket * 2, 50); // 최대 +50점
      }
      
      return Math.min(score, 100);
    };

    /**
     * P5. 신뢰도 계산
     * - 제조사 신뢰도, 효능 정보 완성도
     */
    const calculateReliability = (medicine) => {
      let score = 0;
      
      // 효능 정보가 상세할수록 높은 점수
      const efcyQesitm = medicine.efcyQesitm || '';
      if (efcyQesitm.length > 200) score += 40;
      else if (efcyQesitm.length > 100) score += 25;
      else if (efcyQesitm.length > 50) score += 10;
      
      // 사용법 정보 완성도
      const useMethodQesitm = medicine.useMethodQesitm || '';
      if (useMethodQesitm.length > 100) score += 30;
      else if (useMethodQesitm.length > 50) score += 15;
      
      // 보관 정보 완성도
      const depositMethodQesitm = medicine.depositMethodQesitm || '';
      if (depositMethodQesitm.length > 0) score += 30;
      
      return Math.min(score, 100);
    };

    // 각 약품별 5가지 지표 계산
    const datasets = topMedicines.map((medicine, index) => {
      const colors = [
        { border: 'rgba(245, 213, 71, 1)', bg: 'rgba(245, 213, 71, 0.2)' },     // 노란색
        { border: 'rgba(75, 192, 192, 1)', bg: 'rgba(75, 192, 192, 0.2)' },     // 청록색
        { border: 'rgba(255, 99, 132, 1)', bg: 'rgba(255, 99, 132, 0.2)' }      // 빨간색
      ];

      return {
        label: medicine.itemName || medicine.name || `약품 ${index + 1}`,
        data: [
          calculateSideEffectRisk(medicine),     // P1: 부작용 위험 (역)
          calculateInteractionRisk(medicine),    // P2: 상호작용 위험 (역)
          calculateConvenience(medicine),        // P3: 복용 편의성
          calculateSafety(medicine),             // P4: 안전성 점수
          calculateReliability(medicine)         // P5: 신뢰도
        ],
        borderColor: colors[index].border,
        backgroundColor: colors[index].bg,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    });

    const data = {
      labels: [
        '부작용 안전성',     // P1 (높을수록 부작용 적음)
        '상호작용 안전성',   // P2 (높을수록 상호작용 적음)
        '복용 편의성',       // P3 (높을수록 편리)
        '시장 안전성',       // P4 (높을수록 검증됨)
        '정보 신뢰도'        // P5 (높을수록 정보 완전)
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
              size: 12,
              family: "'Noto Sans KR', sans-serif"
            },
            padding: 15,
            usePointStyle: true,
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: {
            size: 14,
            family: "'Noto Sans KR', sans-serif"
          },
          bodyFont: {
            size: 12,
            family: "'Noto Sans KR', sans-serif"
          },
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.r.toFixed(1)}점`;
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
            stepSize: 25,
            font: {
              size: 10
            },
            callback: function(value) {
              return value;
            }
          },
          pointLabels: {
            font: {
              size: 12,
              family: "'Noto Sans KR', sans-serif",
              weight: 'bold'
            },
            color: '#333',
            padding: 10,
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
            circular: true
          },
          angleLines: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        }
      }
    };

    return { chartData: data, chartOptions: options };
  }, [medicines]);

  if (!chartData) {
    return (
      <div className="radar-chart-container empty">
        <p className="empty-message">📊 약품을 추가하면 안전성/편의성 비교 그래프가 표시됩니다</p>
      </div>
    );
  }

  return (
    <div className="radar-chart-container">
      <div className="chart-header">
        <h3>📊 약품 안전성 & 복용 편의성 비교</h3>
        <p className="chart-description">
          5가지 핵심 지표로 약품을 비교 분석합니다 (최대 3개)
        </p>
      </div>
      <div className="chart-canvas-wrapper">
        <Radar data={chartData} options={chartOptions} />
      </div>
      <div className="chart-footer">
        <div className="chart-legend-info">
          <p>💡 <strong>높을수록 좋음:</strong> 모든 지표는 0-100점 스케일로 정규화됩니다</p>
          <ul className="indicator-list">
            <li>🛡️ <strong>부작용 안전성:</strong> 부작용 정보가 적을수록 높음</li>
            <li>⚠️ <strong>상호작용 안전성:</strong> 다른 약과 상호작용이 적을수록 높음</li>
            <li>💊 <strong>복용 편의성:</strong> 하루 복용 횟수가 적을수록 높음</li>
            <li>✅ <strong>시장 안전성:</strong> 시장 출시 연수가 오래될수록 높음 (검증됨)</li>
            <li>📋 <strong>정보 신뢰도:</strong> 약품 정보가 상세할수록 높음</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MedicineRadarChart;
