import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfileSetup.scss';
import img_main from '../assets/images/img_main.png';
import { saveUserProfile, getSelectedDiseases } from '../utils/deviceId';
import { updateUserProfile } from '../services/api';

const ProfileSetup = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState(''); // 'male' or 'female'
  const [validationError, setValidationError] = useState('');

  const handleBirthYearChange = (e) => {
    const value = e.target.value;
    
    // 숫자만 입력 허용
    if (value && !/^\d+$/.test(value)) {
      setValidationError('숫자만 입력해주세요');
      return;
    }
    
    // 4자리 제한
    if (value.length > 4) {
      return;
    }
    
    setBirthYear(value);
    
    // 유효성 검증
    if (value.length === 4) {
      const year = parseInt(value);
      if (year < 1900 || year > currentYear) {
        setValidationError(`1900년부터 ${currentYear}년 사이로 입력해주세요`);
      } else {
        setValidationError('');
      }
    } else {
      setValidationError('');
    }
  };

  const handleGenderSelect = (selectedGender) => {
    setGender(selectedGender);
  };

  const handleNext = async () => {
    // 유효성 검증
    if (!birthYear || birthYear.length !== 4) {
      setValidationError('출생 연도를 정확히 입력해주세요');
      return;
    }

    const year = parseInt(birthYear);
    if (year < 1900 || year > currentYear) {
      setValidationError(`1900년부터 ${currentYear}년 사이로 입력해주세요`);
      return;
    }

    if (!gender) {
      setValidationError('성별을 선택해주세요');
      return;
    }

    // 나이 계산
    const age = currentYear - year;

    // 프로필 저장 (로컬)
    saveUserProfile({ birthYear: year, gender, age });
    console.log('프로필 저장됨:', { birthYear: year, gender, age });

    // 🔥 백엔드에 사용자 프로필 동기화
    try {
      const genderKorean = gender === 'male' ? '남성' : '여성';
      await updateUserProfile({ age, gender: genderKorean });
      console.log('[ProfileSetup] 백엔드 프로필 동기화 완료');
    } catch (error) {
      console.error('[ProfileSetup] 백엔드 프로필 동기화 실패:', error);
    }

    // 질병 정보 확인
    const diseases = getSelectedDiseases();
    console.log('[ProfileSetup] 질병 정보 확인:', diseases);

    if (diseases && diseases.length > 0) {
      // 이미 질병 정보 있음 → 메인으로
      console.log('[ProfileSetup] 질병 정보 있음 → Main 이동');
      navigate('/main');
    } else {
      // 질병 정보 없음 → 질병 선택 페이지로
      console.log('[ProfileSetup] 질병 정보 없음 → SelectOption 이동');
      navigate('/select');
    }
  };

  const calculateAge = () => {
    if (birthYear && birthYear.length === 4) {
      const year = parseInt(birthYear);
      if (year >= 1900 && year <= currentYear) {
        return currentYear - year;
      }
    }
    return null;
  };

  const age = calculateAge();

  return (
    <div className="profile-setup">
      <div className="profile-setup__background">
        <div className="profile-setup__content">
          <h1 className="profile-setup__title">
            당신의 정보를<br />알려주셔유~
          </h1>

          <div className="profile-setup__pig-section">
            <img src={img_main} alt="Pig" className="profile-setup__pig-image" />
          </div>

          <div className="profile-setup__form">
            {/* 출생 연도 입력 */}
            <div className="profile-setup__input-group">
              <label className="profile-setup__label">출생 연도</label>
              <div className="profile-setup__input-wrapper">
                <input
                  type="text"
                  inputMode="numeric"
                  className="profile-setup__input"
                  placeholder="1990"
                  value={birthYear}
                  onChange={handleBirthYearChange}
                  maxLength={4}
                />
                {age !== null && (
                  <span className="profile-setup__age-display">
                    ({age}세)
                  </span>
                )}
              </div>
            </div>

            {/* 성별 선택 */}
            <div className="profile-setup__input-group">
              <label className="profile-setup__label">성별</label>
              <div className="profile-setup__gender-tabs">
                <button
                  type="button"
                  className={`profile-setup__gender-tab ${gender === 'male' ? 'profile-setup__gender-tab--active' : ''}`}
                  onClick={() => handleGenderSelect('male')}
                >
                  남성
                </button>
                <button
                  type="button"
                  className={`profile-setup__gender-tab ${gender === 'female' ? 'profile-setup__gender-tab--active' : ''}`}
                  onClick={() => handleGenderSelect('female')}
                >
                  여성
                </button>
              </div>
            </div>

            {/* 유효성 검증 오류 메시지 */}
            {validationError && (
              <div className="profile-setup__error">
                ⚠️ {validationError}
              </div>
            )}
          </div>

          <button
            className="profile-setup__next-button"
            onClick={handleNext}
            disabled={!birthYear || !gender || birthYear.length !== 4}
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
