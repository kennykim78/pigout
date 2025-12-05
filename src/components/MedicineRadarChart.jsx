import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import './MedicineRadarChart.scss';

/**
 * 등록된 약품의 성분을 분석한 방사형 그래프
 * - 주요 성분별 사용 빈도 표시
 * - 시각적으로 약품 구성 파악 용이
 */
const MedicineRadarChart = ({ medicines }) => {
  const chartData = useMemo(() => {
    if (!medicines || medicines.length === 0) return [];

    // 성분별 사용 빈도 계산
    const componentMap = {};
    const componentCategories = {
      '해열·진통': ['아세트아미노펜', '이부프로펜', '진통', '해열'],
      '소염·항염': ['소염', '항염', '나프록센', '인도메타신'],
      '감기·기침': ['기침', '감기', '감기약', '기침약'],
      '소화': ['소화', '소화제', '팬크레아제'],
      '영양·보충': ['유산균', '비타민', '칼슘', '철분', '오메가'],
      '항히스타민': ['항히스타민', '알레르기'],
    };

    medicines.forEach(medicine => {
      const itemName = medicine.itemName || medicine.name || '';
      const efcyQesitm = medicine.efcyQesitm || '';
      const searchText = `${itemName} ${efcyQesitm}`.toLowerCase();

      Object.entries(componentCategories).forEach(([category, keywords]) => {
        if (keywords.some(kw => searchText.includes(kw.toLowerCase()))) {
          componentMap[category] = (componentMap[category] || 0) + 1;
        }
      });
    });

    // 데이터 변환 (Recharts 형식)
    const data = Object.entries(componentMap).map(([name, value]) => ({
      name,
      value: Math.min(value * 20, 100), // 스케일링 (최대 100)
      count: value,
    }));

    return data.length > 0 ? data : [];
  }, [medicines]);

  if (chartData.length === 0) {
    return (
      <div className="radar-chart-container empty">
        <p className="empty-message">📊 약품을 추가하면 성분 분석 그래프가 표시됩니다</p>
      </div>
    );
  }

  return (
    <div className="radar-chart-container">
      <div className="chart-header">
        <h3>📊 등록된 약품 성분 분석</h3>
        <p className="chart-description">약품별 주요 성분 구성을 한눈에 확인하세요</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <PolarGrid stroke="#f5d547" strokeDasharray="3 3" />
          <PolarAngleAxis dataKey="name" stroke="#333" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#ccc" />
          <Radar
            name="성분 빈도"
            dataKey="value"
            stroke="#f5d547"
            fill="#f5d547"
            fillOpacity={0.6}
            dot={{ fill: '#333', r: 5 }}
            activeDot={{ r: 7, fill: '#333' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '2px solid #f5d547',
              borderRadius: '8px',
              color: '#333',
            }}
            formatter={(value, name, payload) => [
              `${payload.payload.count}개 약품`,
              '약품 수'
            ]}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
      <div className="chart-footer">
        <p>✨ 성분 다양도: {chartData.length > 0 ? '다양함' : '단일'}</p>
      </div>
    </div>
  );
};

export default MedicineRadarChart;
