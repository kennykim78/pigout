import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './IntroSplash.scss';
import imgMain from '../assets/images/img_main.png';

const IntroSplash = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/select');
    }, 5000);

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
