import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './IntroSplash.scss';
import pigoutLogo from '../assets/images/pigout_logo.svg';
import { getUserProfile, getSelectedDiseases } from '../utils/deviceId';

const IntroSplash = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      // 1. 나이/성별 정보 확인
      const userProfile = getUserProfile();
      
      if (!userProfile) {
        // 나이/성별 정보 없음 → 프로필 입력 페이지로
        console.log('[IntroSplash] 프로필 정보 없음 → ProfileSetup 이동');
        navigate('/profile');
        return;
      }

      // 2. 질병 정보 확인
      const diseases = getSelectedDiseases();
      
      if (diseases.length === 0) {
        // 질병 정보 없음 → 질병 선택 페이지로
        console.log('[IntroSplash] 질병 정보 없음 → SelectOption 이동');
        navigate('/select');
      } else {
        // 모든 정보 있음 → 메인으로
        console.log('[IntroSplash] 온보딩 완료 → Main 이동');
        navigate('/main');
      }
    }, 3000); // 3초로 단축

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="intro-splash">
      <div className="intro-splash__background">
        <div className="intro-splash__red-shape" />
        <div className="intro-splash__black-shape" />
        <div className="intro-splash__text-group">
          <div className="intro-splash__text-accent">진짜?</div>
          <div className="intro-splash__text-main">정말?</div>
          <div className="intro-splash__text-korean">맘껏?</div>
        </div>
        <img src={imgMain} alt="Pig" className="intro-splash__pig-image" />
        <div className="intro-splash__disclaimer">
          <p>본 앱은 의료 조언을 제공하지 않으며, 모든 건강 관련 결정은 반드시 전문의와 상의해야 합니다. 본 앱의 정보는 참고용으로만 제공됩니다.</p>
        </div>
      </div>
    </div>
  );
};

export default IntroSplash;
