import './Settings.scss';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
  const navigate = useNavigate();
  
  // 현재 설정된 질병 (나중에 전역 상태 관리로 변경)
  const currentDiseases = ['당뇨', '고혈압'];

  return (
    <div className="settings">
      <div className="settings__header">
        <button className="settings__back-button" onClick={() => navigate(-1)}>
          <span className="material-symbols-rounded">arrow_back</span>
        </button>
        <h1 className="settings__title">설정</h1>
      </div>

      <div className="settings__content">
        <div className="settings__section">
          <button 
            className="settings__menu-item settings__menu-item--primary"
            onClick={() => navigate('/selectoption')}
          >
            <span className="settings__menu-icon material-symbols-rounded">
              medical_services
            </span>
            <span className="settings__menu-text">질병 재설정</span>
            <span className="material-symbols-rounded">chevron_right</span>
          </button>
        </div>

        <div className="settings__section">
          <div className="settings__info-item">
            <div className="settings__info-header">
              <span className="settings__info-icon material-symbols-rounded">
                health_and_safety
              </span>
              <span className="settings__info-label">현재 설정된 질병</span>
            </div>
            <div className="settings__disease-tags">
              {currentDiseases.length > 0 ? (
                currentDiseases.map((disease, index) => (
                  <span key={index} className="settings__disease-tag">
                    {disease}
                  </span>
                ))
              ) : (
                <span className="settings__disease-empty">설정된 질병이 없습니다</span>
              )}
            </div>
          </div>
        </div>

        <div className="settings__section">
          <button 
            className="settings__menu-item"
            onClick={() => navigate('/history')}
          >
            <span className="settings__menu-icon material-symbols-rounded">
              history
            </span>
            <span className="settings__menu-text">히스토리</span>
            <span className="material-symbols-rounded">chevron_right</span>
          </button>

          <button 
            className="settings__menu-item"
            onClick={() => navigate('/contact')}
          >
            <span className="settings__menu-icon material-symbols-rounded">
              mail
            </span>
            <span className="settings__menu-text">Contact Us</span>
            <span className="material-symbols-rounded">chevron_right</span>
          </button>
        </div>

        <div className="settings__section">
          <div className="settings__info-item">
            <div className="settings__info-header">
              <span className="settings__info-icon material-symbols-rounded">
                info
              </span>
              <span className="settings__info-label">Version</span>
            </div>
            <span className="settings__version-text">v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
