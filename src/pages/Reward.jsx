import { useState, useEffect } from 'react';
import { useRewardStore } from '../store/rewardStore';
import { getRewardPoints, getRewardItems, getRewardHistory, claimReward } from '../services/api';
import './Reward.scss';

const Reward = () => {
  const {
    currentPoints,
    lifetimeEarned,
    lifetimeSpent,
    rewardItems,
    pointHistory,
    setPoints,
    setRewardItems,
    setPointHistory,
    isLoading,
    setLoading,
  } = useRewardStore();

  const [activeTab, setActiveTab] = useState('items');

  useEffect(() => {
    loadRewardData();
  }, []);

  const loadRewardData = async () => {
    setLoading(true);
    try {
      const [pointsData, itemsData, historyData] = await Promise.all([
        getRewardPoints(),
        getRewardItems(),
        getRewardHistory(),
      ]);

      setPoints(pointsData);
      setRewardItems(itemsData);
      setPointHistory(historyData);
    } catch (error) {
      console.error('Failed to load reward data:', error);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (itemId, itemName, pointCost) => {
    if (currentPoints < pointCost) {
      alert(`포인트가 부족합니다. (현재: ${currentPoints}P, 필요: ${pointCost}P)`);
      return;
    }

    if (!confirm(`${itemName}을(를) ${pointCost}P로 교환하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await claimReward(itemId);
      alert(`${result.rewardName} 교환 완료!\n잔여 포인트: ${result.remainingPoints}P`);
      loadRewardData(); // 데이터 새로고침
    } catch (error) {
      console.error('Claim reward failed:', error);
      alert(error.response?.data?.message || '교환에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reward">
      <header className="reward__header">
        <h1 className="reward__title">🎁 리워드</h1>
        <div className="reward__points-card">
          <div className="reward__points-main">
            <span className="reward__points-label">보유 포인트</span>
            <span className="reward__points-value">{currentPoints.toLocaleString()}P</span>
          </div>
          <div className="reward__points-stats">
            <div className="reward__stat">
              <span className="reward__stat-label">누적 적립</span>
              <span className="reward__stat-value">{lifetimeEarned.toLocaleString()}P</span>
            </div>
            <div className="reward__stat">
              <span className="reward__stat-label">누적 사용</span>
              <span className="reward__stat-value">{lifetimeSpent.toLocaleString()}P</span>
            </div>
          </div>
        </div>
      </header>

      <div className="reward__tabs">
        <button
          className={`reward__tab ${activeTab === 'items' ? 'reward__tab--active' : ''}`}
          onClick={() => setActiveTab('items')}
        >
          상품 교환
        </button>
        <button
          className={`reward__tab ${activeTab === 'history' ? 'reward__tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          포인트 내역
        </button>
      </div>

      {activeTab === 'items' && (
        <div className="reward__items">
          <p className="reward__items-desc">
            매일 평균 70점 이상 유지 시 포인트가 적립됩니다!
          </p>
          {isLoading ? (
            <p className="reward__loading">로딩 중...</p>
          ) : (
            <div className="reward__grid">
              {rewardItems.map((item) => (
                <div key={item.id} className="reward__card">
                  <div className="reward__card-image">
                    <img src={item.image_url} alt={item.name} />
                  </div>
                  <div className="reward__card-content">
                    <span className="reward__card-brand">{item.brand}</span>
                    <h3 className="reward__card-title">{item.name}</h3>
                    <p className="reward__card-desc">{item.description}</p>
                    <div className="reward__card-footer">
                      <span className="reward__card-price">{item.point_cost.toLocaleString()}P</span>
                      <button
                        className="reward__card-btn"
                        onClick={() => handleClaimReward(item.id, item.name, item.point_cost)}
                        disabled={!item.is_available || currentPoints < item.point_cost || isLoading}
                      >
                        {currentPoints < item.point_cost ? '포인트 부족' : '교환하기'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="reward__history">
          {isLoading ? (
            <p className="reward__loading">로딩 중...</p>
          ) : pointHistory.length === 0 ? (
            <div className="reward__empty">
              <p>포인트 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="reward__history-list">
              {pointHistory.map((item) => (
                <div key={item.id} className="reward__history-item">
                  <div className="reward__history-icon">
                    {item.type === 'earn' ? '💰' : item.type === 'spend' ? '🎁' : '⏰'}
                  </div>
                  <div className="reward__history-content">
                    <h4 className="reward__history-title">
                      {item.type === 'earn'
                        ? '포인트 적립'
                        : item.type === 'spend'
                        ? `${item.reward_name} 교환`
                        : '포인트 소멸'}
                    </h4>
                    <p className="reward__history-date">
                      {new Date(item.created_at).toLocaleString('ko-KR')}
                    </p>
                    {item.reason && (
                      <p className="reward__history-reason">
                        {item.reason === 'daily_70' ? '일평균 70점 달성' : 
                         item.reason === 'daily_85' ? '일평균 85점 달성' : item.reason}
                      </p>
                    )}
                  </div>
                  <div className="reward__history-points">
                    <span className={`reward__history-value reward__history-value--${item.type}`}>
                      {item.points > 0 ? `+${item.points}` : item.points}P
                    </span>
                    <span className="reward__history-balance">잔액: {item.balance_after}P</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reward;
