import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useRewardStore } from '../store/rewardStore';
import { getRewardPoints, getStatsSummary, getMonthlyReport } from '../services/api';
import './MyPage.scss';

const MyPage = () => {
  const navigate = useNavigate();
  const { user, updateDiseases, logout } = useAuthStore();
  const { currentPoints } = useRewardStore();
  const [stats, setStats] = useState({
    totalRecords: 0,
    avgScore30Days: 0,
    recentDays: 0,
  });
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentRecords, setRecentRecords] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // localStorage에서 질병 정보 로드
      const savedDiseases = localStorage.getItem('selectedDiseases');
      console.log('localStorage에서 로드한 질병:', savedDiseases);
      
      if (savedDiseases) {
        const parsedDiseases = JSON.parse(savedDiseases);
        console.log('파싱된 질병 목록:', parsedDiseases);
        setDiseases(parsedDiseases);
        updateDiseases(parsedDiseases);
      }
      
      // API에서 통계 데이터 로드
      const [pointsData, statsData] = await Promise.all([
        getRewardPoints(),
        getStatsSummary(),
      ]);
      
      console.log('포인트 데이터:', pointsData);
      console.log('통계 데이터:', statsData);
      
      useRewardStore.getState().setPoints(pointsData);
      setStats(statsData);
      
      // 최근 기록 3개 로드 (임시 데이터)
      // TODO: API에서 실제 데이터 가져오기
      setRecentRecords([
        { id: 1, foodName: '김치찌개', score: 75, date: '2025-11-17', time: '12:30' },
        { id: 2, foodName: '비빔밥', score: 85, date: '2025-11-16', time: '18:20' },
        { id: 3, foodName: '삼겹살', score: 60, date: '2025-11-15', time: '19:15' },
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      logout();
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="mypage">
        <div className="mypage__loading">
          <p>로딩중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mypage">
      {/* 헤더 */}
      <header className="mypage__header">
        <h1 className="mypage__title">마이페이지</h1>
      </header>

      {/* 프로필 카드 */}
      <section className="mypage__profile-card">
        <div className="mypage__profile-icon">🐷</div>
        <div className="mypage__profile-info">
          <h2 className="mypage__profile-name">{user?.full_name || '먹어도돼지 사용자'}</h2>
          <p className="mypage__profile-email">{user?.username || 'user@pigout.com'}</p>
        </div>
      </section>

      {/* 포인트 카드 */}
      <section className="mypage__points-card">
        <div className="mypage__points-label">
          <span className="mypage__points-icon">💰</span>
          <span>보유 포인트</span>
        </div>
        <div className="mypage__points-value">{currentPoints.toLocaleString()}P</div>
      </section>

      {/* 건강 통계 */}
      <section className="mypage__stats-section">
        <h2 className="mypage__section-title">나의 건강 기록</h2>
        <div className="mypage__stats-grid">
          <div className="mypage__stat-item">
            <div className="mypage__stat-value">{stats.totalRecords}</div>
            <div className="mypage__stat-label">총 기록</div>
          </div>
          <div className="mypage__stat-item">
            <div className="mypage__stat-value">{stats.avgScore30Days}</div>
            <div className="mypage__stat-label">평균 점수</div>
          </div>
          <div className="mypage__stat-item">
            <div className="mypage__stat-value">{stats.recentDays}</div>
            <div className="mypage__stat-label">활동 일수</div>
          </div>
        </div>
      </section>

      {/* 질병 정보 */}
      <section className="mypage__diseases-section">
        <div className="mypage__diseases-header">
          <h2 className="mypage__section-title">나의 건강 정보</h2>
          <button
            className="mypage__edit-button"
            onClick={() => navigate('/select')}
          >
            수정
          </button>
        </div>
        <div className="mypage__diseases-list">
          {diseases && diseases.length > 0 ? (
            diseases.map((disease, index) => (
              <div key={index} className="mypage__disease-tag">
                {disease}
              </div>
            ))
          ) : (
            <div className="mypage__diseases-empty">
              <p>등록된 질병 정보가 없습니다.</p>
              <button
                className="mypage__add-disease-button"
                onClick={() => navigate('/select')}
              >
                질병 정보 등록하기
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 최근 내역 */}
      <section className="mypage__recent-section">
        <div className="mypage__recent-header">
          <h2 className="mypage__section-title">최근 내역</h2>
          <button
            className="mypage__more-button"
            onClick={() => navigate('/history')}
          >
            더보기 ›
          </button>
        </div>
        <div className="mypage__recent-list">
          {recentRecords.length > 0 ? (
            recentRecords.map((record) => (
              <div key={record.id} className="mypage__recent-item">
                <div className="mypage__recent-icon">🍽️</div>
                <div className="mypage__recent-info">
                  <div className="mypage__recent-name">{record.foodName}</div>
                  <div className="mypage__recent-time">{record.time}</div>
                </div>
                <div className="mypage__recent-score">{record.score}점</div>
              </div>
            ))
          ) : (
            <div className="mypage__recent-empty">
              <p>최근 기록이 없습니다</p>
            </div>
          )}
        </div>
      </section>

      {/* 메뉴 */}
      <section className="mypage__menu-section">
        <button className="mypage__menu-button" onClick={() => navigate('/medicine')}>
          <span className="mypage__menu-text">💊 복용 중인 약</span>
          <span className="mypage__menu-arrow">›</span>
        </button>
        <button className="mypage__menu-button" onClick={() => navigate('/contact')}>
          <span className="mypage__menu-text">📧 Contact Us</span>
          <span className="mypage__menu-arrow">›</span>
        </button>
        <button className="mypage__menu-button mypage__menu-button--logout" onClick={handleLogout}>
          <span className="mypage__menu-text">🚪 로그아웃</span>
          <span className="mypage__menu-arrow">›</span>
        </button>
      </section>

      <div className="mypage__footer">
        <p>먹어도돼지? v1.0.0</p>
      </div>
    </div>
  );
};

export default MyPage;
