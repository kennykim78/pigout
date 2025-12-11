import React, { useEffect, useRef } from 'react';
import './MedicineInteractionNetwork.scss';

/**
 * 약물 상호작용 네트워크 시각화 컴포넌트
 * 
 * 각 약물을 노드로, 상호작용을 엣지로 표현
 * 위험도에 따라 색상 코딩 (빨강=위험, 주황=주의, 초록=안전)
 */
const MedicineInteractionNetwork = ({ medicines = [], interactions = [] }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || medicines.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 캔버스 크기 설정
    const width = canvas.offsetWidth || 400;
    const height = canvas.offsetHeight || 300;
    canvas.width = width;
    canvas.height = height;

    // 노드 데이터 준비 (위치 계산)
    const nodes = medicines.map((medicine, idx) => {
      const angle = (idx / medicines.length) * Math.PI * 2;
      const radius = Math.min(width, height) / 3;
      const x = width / 2 + radius * Math.cos(angle);
      const y = height / 2 + radius * Math.sin(angle);
      
      return {
        id: medicine.itemSeq || idx,
        name: medicine.name || medicine.itemName,
        x,
        y,
        radius: 30
      };
    });

    // 엣지 데이터 준비
    const edges = interactions
      .filter(interaction => interaction.medicines && interaction.medicines.length >= 2)
      .map(interaction => ({
        source: interaction.medicines[0],
        target: interaction.medicines[1],
        riskLevel: interaction.riskLevel || 'safe',
        description: interaction.description || ''
      }));

    // 배경 그리기
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(0, 0, width, height);

    // 엣지 그리기
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return;

      // 위험도에 따른 색상
      const colorMap = {
        danger: { color: '#F14444', width: 3, opacity: 0.8 },
        caution: { color: '#FFA100', width: 2, opacity: 0.6 },
        safe: { color: '#4CB150', width: 1, opacity: 0.4 }
      };
      
      const style = colorMap[edge.riskLevel] || colorMap.safe;
      
      ctx.strokeStyle = style.color;
      ctx.globalAlpha = style.opacity;
      ctx.lineWidth = style.width;
      ctx.setLineDash(edge.riskLevel === 'danger' ? [5, 5] : []);
      
      ctx.beginPath();
      ctx.moveTo(sourceNode.x, sourceNode.y);
      ctx.lineTo(targetNode.x, targetNode.y);
      ctx.stroke();
      
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    });

    // 노드 그리기
    nodes.forEach((node, idx) => {
      const medicine = medicines[idx];
      
      // 노드 배경
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 위험도 인디케이터 (작은 원)
      const hasInteractions = edges.some(e => 
        (e.source === node.id || e.target === node.id)
      );
      
      if (hasInteractions) {
        const riskLevel = edges
          .filter(e => e.source === node.id || e.target === node.id)
          .sort((a, b) => {
            const riskScore = { danger: 3, caution: 2, safe: 1 };
            return (riskScore[b.riskLevel] || 0) - (riskScore[a.riskLevel] || 0);
          })[0]?.riskLevel || 'safe';
        
        const colorMap = {
          danger: '#F14444',
          caution: '#FFA100',
          safe: '#4CB150'
        };
        
        ctx.fillStyle = colorMap[riskLevel];
        ctx.beginPath();
        ctx.arc(node.x + node.radius - 8, node.y - node.radius + 8, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 텍스트 그리기 (약물명)
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    nodes.forEach((node) => {
      const text = node.name.length > 8 ? node.name.substring(0, 7) + '...' : node.name;
      ctx.fillText(text, node.x, node.y);
    });

    // 범례 그리기
    const legendX = 10;
    const legendY = 10;
    const legendItems = [
      { color: '#F14444', label: '위험', width: 3 },
      { color: '#FFA100', label: '주의', width: 2 },
      { color: '#4CB150', label: '안전', width: 1 }
    ];

    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    legendItems.forEach((item, idx) => {
      const y = legendY + idx * 20;
      
      // 색상 표시
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width;
      ctx.beginPath();
      ctx.moveTo(legendX, y + 5);
      ctx.lineTo(legendX + 20, y + 5);
      ctx.stroke();
      
      // 레이블
      ctx.fillStyle = '#666';
      ctx.fillText(item.label, legendX + 30, y + 5);
    });

  }, [medicines, interactions]);

  return (
    <div className="medicine-interaction-network">
      <div className="medicine-interaction-header">
        <h3>🕸️ 약물 상호작용 네트워크</h3>
        <p className="medicine-interaction-desc">
          복용 중인 약물 간의 상호작용을 시각화합니다
        </p>
      </div>
      
      <div className="medicine-interaction-canvas-container">
        <canvas
          ref={canvasRef}
          className="medicine-interaction-canvas"
        />
      </div>

      {medicines.length === 0 && (
        <div className="medicine-interaction-empty">
          <p>복용 중인 약물이 없습니다.</p>
        </div>
      )}

      {medicines.length > 0 && medicines.length < 2 && (
        <div className="medicine-interaction-info">
          <p>ⓘ 약물 상호작용을 분석하려면 최소 2개 이상의 약물이 필요합니다.</p>
        </div>
      )}
    </div>
  );
};

export default MedicineInteractionNetwork;
