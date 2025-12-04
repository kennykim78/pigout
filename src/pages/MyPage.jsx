import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useRewardStore } from '../store/rewardStore';
import { getRewardPoints, getStatsSummary, getAnalysisHistory, getMyMedicines } from '../services/api';
import { scoreToLifeDays, formatLifeDays, getLifeDaysColorClass } from '../utils/lifeScoreUtils';
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
  const [medicines, setMedicines] = useState([]);
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
      
      // API에서 데이터 로드
      const [pointsData, statsData, historyData, medicineData] = await Promise.all([
        getRewardPoints().catch(() => ({ currentPoints: 0 })),
        getStatsSummary().catch(() => ({ totalRecords: 0, avgScore30Days: 0, recentDays: 0 })),
        getAnalysisHistory(5, 0).catch(() => ({ data: [] })),
        getMyMedicines(true).catch(() => []),
      ]);
      
      console.log('포인트 데이터:', pointsData);
      console.log('통계 데이터:', statsData);
      console.log('히스토리 데이터:', historyData);
      console.log('복용약 데이터:', medicineData);
      
      useRewardStore.getState().setPoints(pointsData);
      setStats(statsData);
      setMedicines(Array.isArray(medicineData) ? medicineData : (medicineData?.data || []));
      
      // 최근 기록 포맷팅
      const records = historyData?.data || [];
      const formattedRecords = records.slice(0, 5).map(record => ({
        id: record.id,
        foodName: record.food_name,
        score: record.score,
        analysis: record.analysis,
        imageUrl: record.image_url,
        detailedAnalysis: record.detailed_analysis,
        time: new Date(record.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        date: new Date(record.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
      }));
      setRecentRecords(formattedRecords);
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

  const getScoreColor = (score) => {
    const lifeDays = scoreToLifeDays(score);
    return getLifeDaysColorClass(lifeDays);
  };

  const getLifeDaysDisplay = (score) => {
    const lifeDays = scoreToLifeDays(score);
    return formatLifeDays(lifeDays);
  };

  if (loading) {
    return (
      <div className="mypage">
        <div className="mypage__loading">
          <div className="mypage__loading-spinner"></div>
          <p>로딩중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mypage">
      {/* 헤더 */}
      <header className="mypage__header">
        <button className="mypage__back-btn" onClick={() => navigate(-1)}>
          <span className="material-symbols-rounded">arrow_back</span>
        </button>
        <h1 className="mypage__title">마이페이지</h1>
        <button className="mypage__settings-btn" onClick={() => navigate('/settings')}>
          <span className="material-symbols-rounded">settings</span>
        </button>
      </header>

      {/* 프로필 카드 */}
      <section className="mypage__profile-card">
        <div className="mypage__profile-avatar">🐷</div>
        <div className="mypage__profile-info">
          <h2 className="mypage__profile-name">{user?.full_name || '먹어도돼지 사용자'}</h2>
          <p className="mypage__profile-id">ID: {user?.username || localStorage.getItem('pigout_device_id')?.substring(0, 8) || 'guest'}</p>
        </div>
        <div className="mypage__points-badge" onClick={() => navigate('/reward')}>
          <span className="mypage__points-icon">💰</span>
          <span className="mypage__points-value">{currentPoints.toLocaleString()}P</span>
        </div>
      </section>

      {/* 통계 카드 */}
      <section className="mypage__stats-card">
        <div className="mypage__stat-item">
          <div className="mypage__stat-icon">📊</div>
          <div className="mypage__stat-value">{stats.totalRecords || 0}</div>
          <div className="mypage__stat-label">총 기록</div>
        </div>
        <div className="mypage__stat-divider"></div>
        <div className="mypage__stat-item">
          <div className="mypage__stat-icon">⭐</div>
          <div className="mypage__stat-value">{stats.avgScore30Days || 0}</div>
          <div className="mypage__stat-label">평균 점수</div>
        </div>
        <div className="mypage__stat-divider"></div>
        <div className="mypage__stat-item">
          <div className="mypage__stat-icon">🔥</div>
          <div className="mypage__stat-value">{stats.recentDays || 0}</div>
          <div className="mypage__stat-label">활동 일수</div>
        </div>
      </section>

      {/* 건강 정보 (질병) */}
      <section className="mypage__section">
        <div className="mypage__section-header">
          <h2 className="mypage__section-title">
            <span className="mypage__section-icon">🏥</span>
            나의 건강 정보
          </h2>
          <button className="mypage__edit-btn" onClick={() => navigate('/selectoption')}>
            수정
          </button>
        </div>
        <div className="mypage__disease-list">
          {diseases && diseases.length > 0 ? (
            diseases.map((disease, index) => (
              <span key={index} className="mypage__disease-tag">{disease}</span>
            ))
          ) : (
            <div className="mypage__empty-state">
              <p>등록된 질병 정보가 없습니다</p>
              <button className="mypage__add-btn" onClick={() => navigate('/selectoption')}>
                + 건강 정보 등록
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 복용 중인 약 */}
      <section className="mypage__section">
        <div className="mypage__section-header">
          <h2 className="mypage__section-title">
            <span className="mypage__section-icon">💊</span>
            복용 중인 약
          </h2>
          <button className="mypage__more-btn" onClick={() => navigate('/medicine')}>
            더보기 ›
          </button>
        </div>
        <div className="mypage__medicine-list">
          {medicines && medicines.length > 0 ? (
            medicines.slice(0, 4).map((medicine, index) => (
              <div key={medicine.id || index} className="mypage__medicine-item">
                <div className="mypage__medicine-icon">💊</div>
                <div className="mypage__medicine-info">
                  <div className="mypage__medicine-name">{medicine.name || medicine.item_name}</div>
                  <div className="mypage__medicine-dosage">
                    {medicine.dosage && `${medicine.dosage}`}
                    {medicine.frequency && ` · ${medicine.frequency}`}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="mypage__empty-state">
              <p>등록된 복용약이 없습니다</p>
              <button className="mypage__add-btn" onClick={() => navigate('/medicine')}>
                + 복용약 등록
              </button>
            </div>
          )}
          {medicines && medicines.length > 4 && (
            <div className="mypage__medicine-more">
              +{medicines.length - 4}개 더 보기
            </div>
          )}
        </div>
      </section>

      {/* 최근 분석 내역 */}
      <section className="mypage__section">
        <div className="mypage__section-header">
          <h2 className="mypage__section-title">
            <span className="mypage__section-icon">🍽️</span>
            최근 분석 내역
          </h2>
          <button className="mypage__more-btn" onClick={() => navigate('/history')}>
            더보기 ›
          </button>
        </div>
        <div className="mypage__recent-list">
          {recentRecords.length > 0 ? (
            recentRecords.map((record) => (
              <div key={record.id} className="mypage__recent-item" onClick={() => navigate('/result01', { state: { foodName: record.foodName, score: record.score, analysis: record.analysis, imageUrl: record.imageUrl, detailedAnalysis: record.detailedAnalysis, analysisId: record.id, fromMyPage: true } })}>
                <div className="mypage__recent-info">
                  <div className="mypage__recent-name">{record.foodName}</div>
                  <div className="mypage__recent-time">{record.date} {record.time}</div>
                </div>
                <div className={`mypage__recent-score mypage__recent-score--${getScoreColor(record.score)}`}>
                  {getLifeDaysDisplay(record.score)}
                </div>
              </div>
            ))
          ) : (
            <div className="mypage__empty-state">
              <p>최근 기록이 없습니다</p>
            </div>
          )}
        </div>
      </section>

      {/* 메뉴 */}
      <section className="mypage__menu-section">
        <button className="mypage__menu-item" onClick={() => navigate('/history')}>
          <span className="mypage__menu-icon">📅</span>
          <span className="mypage__menu-text">히스토리</span>
          <span className="mypage__menu-arrow">›</span>
        </button>
        <button className="mypage__menu-item" onClick={() => navigate('/reward')}>
          <span className="mypage__menu-icon">🎁</span>
          <span className="mypage__menu-text">리워드</span>
          <span className="mypage__menu-arrow">›</span>
        </button>
        <button className="mypage__menu-item" onClick={() => navigate('/contact')}>
          <span className="mypage__menu-icon">📧</span>
          <span className="mypage__menu-text">Contact Us</span>
          <span className="mypage__menu-arrow">›</span>
        </button>
        <button className="mypage__menu-item mypage__menu-item--logout" onClick={handleLogout}>
          <span className="mypage__menu-icon">🚪</span>
          <span className="mypage__menu-text">로그아웃</span>
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
