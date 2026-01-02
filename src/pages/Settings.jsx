import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import "./Settings.scss";

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const deviceId = localStorage.getItem("pigout_device_id");

  const handleLogout = () => {
    if (confirm("정말 로그아웃 하시겠습니까?")) {
      logout();
      navigate("/");
    }
  };

  return (
    <div className="settings">
      <header className="settings__header">
        <button className="settings__back-btn" onClick={() => navigate(-1)}>
          <span className="material-symbols-rounded">arrow_back</span>
        </button>
        <h1 className="settings__title">설정</h1>
        <div style={{ width: "44px" }}></div>
      </header>

      <div className="settings__content">
        <section className="settings__section">
          <h2 className="settings__section-title">내 정보</h2>
          <div className="settings__profile-info">
            <div className="settings__info-row">
              <span className="label">이름</span>
              <span className="value">{user?.full_name || "먹어도돼지"}</span>
            </div>
            <div className="settings__info-row">
              <span className="label">기기 ID</span>
              <span className="value">{deviceId?.substring(0, 8) || "-"}</span>
            </div>
          </div>
          <button
            className="settings__menu-item"
            onClick={() => navigate("/selectoption")}
          >
            <span className="icon">edit_square</span>
            <span className="text">프로필 및 건강 정보 수정</span>
            <span className="arrow">chevron_right</span>
          </button>
        </section>

        <section className="settings__section">
          <h2 className="settings__section-title">앱 설정</h2>
          <button className="settings__menu-item">
            <span className="icon">notifications</span>
            <span className="text">알림 설정</span>
            <div className="toggle">
              <input type="checkbox" id="noti-toggle" />
              <label htmlFor="noti-toggle"></label>
            </div>
          </button>
          <button className="settings__menu-item">
            <span className="icon">dark_mode</span>
            <span className="text">다크 모드</span>
            <div className="toggle">
              <input type="checkbox" id="dark-toggle" />
              <label htmlFor="dark-toggle"></label>
            </div>
          </button>
        </section>

        <section className="settings__section">
          <h2 className="settings__section-title">정보</h2>
          <button className="settings__menu-item">
            <span className="icon">description</span>
            <span className="text">서비스 이용약관</span>
            <span className="arrow">chevron_right</span>
          </button>
          <button className="settings__menu-item">
            <span className="icon">lock</span>
            <span className="text">개인정보 처리방침</span>
            <span className="arrow">chevron_right</span>
          </button>
          <div className="settings__version">
            <span>현재 버전</span>
            <span>v1.0.0</span>
          </div>
        </section>

        <button className="settings__logout-btn" onClick={handleLogout}>
          로그아웃
        </button>
        <button className="settings__delete-account-btn">회원 탈퇴</button>
      </div>
    </div>
  );
};

export default Settings;
