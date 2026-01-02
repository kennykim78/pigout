import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { getCurrentUser, updateUserProfile } from "../services/api";
import "./Settings.scss";

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const deviceId = localStorage.getItem("pigout_device_id");

  // 사용자 프로필 데이터
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 설정 상태
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [newNickname, setNewNickname] = useState("");

  // 프로필 로드
  useEffect(() => {
    loadProfile();
    loadSettings();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await getCurrentUser();
      setProfile(data);
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = () => {
    // localStorage에서 설정 불러오기
    const savedNotifications = localStorage.getItem("pigout_notifications");
    const savedDarkMode = localStorage.getItem("pigout_darkmode");

    if (savedNotifications !== null) {
      setNotificationsEnabled(savedNotifications === "true");
    }
    if (savedDarkMode !== null) {
      setDarkModeEnabled(savedDarkMode === "true");
    }
  };

  const handleNotificationToggle = () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    localStorage.setItem("pigout_notifications", String(newValue));
  };

  const handleDarkModeToggle = () => {
    const newValue = !darkModeEnabled;
    setDarkModeEnabled(newValue);
    localStorage.setItem("pigout_darkmode", String(newValue));

    // 다크모드 CSS 적용 (추후 확장 가능)
    if (newValue) {
      document.documentElement.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark-mode");
    }
  };

  const handleLogout = () => {
    if (confirm("정말 로그아웃 하시겠습니까?")) {
      logout();
      navigate("/");
    }
  };

  const handleDeleteAccount = () => {
    if (
      confirm(
        "정말 회원 탈퇴를 하시겠습니까?\n\n모든 데이터가 삭제되며 복구할 수 없습니다."
      )
    ) {
      // TODO: 회원 탈퇴 API 호출
      alert("회원 탈퇴 기능은 준비 중입니다.");
    }
  };

  // 닉네임 수정 핸들러
  const handleEditNickname = () => {
    setNewNickname(profile?.nickname || user?.nickname || "");
    setShowNicknameModal(true);
  };

  const handleSaveNickname = async () => {
    if (!newNickname.trim()) {
      alert("닉네임을 입력해주세요.");
      return;
    }
    try {
      await updateUserProfile({ nickname: newNickname });
      await loadProfile(); // 프로필 새로고침
      setShowNicknameModal(false);
    } catch (error) {
      console.error("Failed to update nickname:", error);
      alert("닉네임 변경에 실패했습니다.");
    }
  };

  // 사용자 정보 표시
  const displayName =
    profile?.nickname || user?.full_name || user?.nickname || "먹어도돼지";
  const displayAge = profile?.age || user?.age || "-";
  const displayGender = profile?.gender || user?.gender || "-";
  const displayDiseases =
    (profile?.diseases || user?.diseases || []).join(", ") || "없음";

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

          {loading ? (
            <div className="settings__loading">불러오는 중...</div>
          ) : (
            <div className="settings__profile-info">
              <div className="settings__info-row">
                <span className="label">닉네임</span>
                <span className="value">{displayName}</span>
              </div>
              <div className="settings__info-row">
                <span className="label">나이</span>
                <span className="value">
                  {displayAge !== "-" ? `${displayAge}세` : "-"}
                </span>
              </div>
              <div className="settings__info-row">
                <span className="label">성별</span>
                <span className="value">{displayGender}</span>
              </div>
              <div className="settings__info-row">
                <span className="label">보유 질환</span>
                <span className="value diseases">{displayDiseases}</span>
              </div>
              <div className="settings__info-row">
                <span className="label">기기 ID</span>
                <span className="value device-id">
                  {deviceId?.substring(0, 8) || "-"}
                </span>
              </div>
            </div>
          )}

          <button className="settings__menu-item" onClick={handleEditNickname}>
            <span className="material-symbols-rounded icon">edit</span>
            <span className="text">닉네임 수정</span>
            <span className="material-symbols-rounded arrow">
              chevron_right
            </span>
          </button>

          <button
            className="settings__menu-item"
            onClick={() =>
              navigate("/profile", { state: { fromSettings: true } })
            }
          >
            <span className="material-symbols-rounded icon">
              accessibility_new
            </span>
            <span className="text">나이/성별 수정</span>
            <span className="material-symbols-rounded arrow">
              chevron_right
            </span>
          </button>

          <button
            className="settings__menu-item"
            onClick={() =>
              navigate("/select", { state: { fromSettings: true } })
            }
          >
            <span className="material-symbols-rounded icon">
              medical_information
            </span>
            <span className="text">질병 정보 수정</span>
            <span className="material-symbols-rounded arrow">
              chevron_right
            </span>
          </button>
        </section>

        <section className="settings__section">
          <h2 className="settings__section-title">앱 설정</h2>
          <div
            className="settings__menu-item"
            onClick={handleNotificationToggle}
          >
            <span className="material-symbols-rounded icon">notifications</span>
            <span className="text">알림 설정</span>
            <div className="toggle">
              <input
                type="checkbox"
                id="noti-toggle"
                checked={notificationsEnabled}
                onChange={handleNotificationToggle}
              />
              <label htmlFor="noti-toggle"></label>
            </div>
          </div>
          <div className="settings__menu-item" onClick={handleDarkModeToggle}>
            <span className="material-symbols-rounded icon">dark_mode</span>
            <span className="text">다크 모드</span>
            <div className="toggle">
              <input
                type="checkbox"
                id="dark-toggle"
                checked={darkModeEnabled}
                onChange={handleDarkModeToggle}
              />
              <label htmlFor="dark-toggle"></label>
            </div>
          </div>
        </section>

        <section className="settings__section">
          <h2 className="settings__section-title">정보</h2>
          <button
            className="settings__menu-item"
            onClick={() => window.open("/terms", "_blank")}
          >
            <span className="material-symbols-rounded icon">description</span>
            <span className="text">서비스 이용약관</span>
            <span className="material-symbols-rounded arrow">
              chevron_right
            </span>
          </button>
          <button
            className="settings__menu-item"
            onClick={() => window.open("/privacy", "_blank")}
          >
            <span className="material-symbols-rounded icon">lock</span>
            <span className="text">개인정보 처리방침</span>
            <span className="material-symbols-rounded arrow">
              chevron_right
            </span>
          </button>
          <div className="settings__version">
            <span>현재 버전</span>
            <span>v1.0.0</span>
          </div>
        </section>

        <button className="settings__logout-btn" onClick={handleLogout}>
          <span className="material-symbols-rounded">logout</span>
          로그아웃
        </button>

        <button
          className="settings__delete-account-btn"
          onClick={handleDeleteAccount}
        >
          회원 탈퇴
        </button>
      </div>

      {/* 닉네임 수정 모달 */}
      {showNicknameModal && (
        <div
          className="settings__modal-overlay"
          onClick={() => setShowNicknameModal(false)}
        >
          <div
            className="settings__modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>닉네임 변경</h3>
            <input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              placeholder="새로운 닉네임 입력"
              maxLength={10}
            />
            <div className="modal-actions">
              <button
                className="cancel"
                onClick={() => setShowNicknameModal(false)}
              >
                취소
              </button>
              <button className="confirm" onClick={handleSaveNickname}>
                변경
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
