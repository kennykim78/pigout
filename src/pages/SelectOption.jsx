import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./SelectOption.scss";
import img_dental from "../assets/images/img_dental.png";
import MedicineAlertModal from "../components/MedicineAlertModal";
import {
  setOnboardingComplete,
  saveSelectedDiseases,
  getSelectedDiseases,
} from "../utils/deviceId";
import { getMyMedicines, updateUserProfile } from "../services/api";

const diseases = [
  "탈모",
  "당뇨",
  "고혈압",
  "고지혈증",
  "통풍",
  "감기",
  "비염",
  "위염",
  "지방간",
  "비만",
  "변비",
  "빈혈",
  "암",
  "여드름",
];

const SelectOption = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDiseases, setSelectedDiseases] = useState([]);
  const [customDisease, setCustomDisease] = useState("");
  const [allDiseases, setAllDiseases] = useState(diseases);
  const [validationError, setValidationError] = useState("");
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [savedMedicinesCount, setSavedMedicinesCount] = useState(0);

  // 페이지 로드 시 복용 중인 약 개수 확인
  useEffect(() => {
    const checkMedicines = async () => {
      try {
        const medicines = await getMyMedicines(true);
        console.log("[SelectOption] 복용 중인 약 목록:", medicines);
        console.log(
          "[SelectOption] 약 개수:",
          Array.isArray(medicines) ? medicines.length : 0
        );
        setSavedMedicinesCount(Array.isArray(medicines) ? medicines.length : 0);
      } catch (error) {
        console.error("[SelectOption] 약 목록 조회 실패:", error);
        setSavedMedicinesCount(0);
      }
    };
    const checkMedicines = async () => {
      try {
        const medicines = await getMyMedicines(true);
        console.log("[SelectOption] 복용 중인 약 목록:", medicines);
        console.log(
          "[SelectOption] 약 개수:",
          Array.isArray(medicines) ? medicines.length : 0
        );
        setSavedMedicinesCount(Array.isArray(medicines) ? medicines.length : 0);
      } catch (error) {
        console.error("[SelectOption] 약 목록 조회 실패:", error);
        setSavedMedicinesCount(0);
      }
    };
    checkMedicines();

    // 기존 설정된 질병 로드 (수정 모드 또는 재방문 시)
    const savedDiseases = getSelectedDiseases();
    if (savedDiseases && savedDiseases.length > 0) {
      setSelectedDiseases(savedDiseases);
    }
  }, []);

  const isValidDisease = (text) => {
    // 2글자 이상
    if (text.length < 2) {
      setValidationError("2글자 이상 입력해주세요");
      return false;
    }

    // 한글, 영문만 허용 (공백 포함)
    const validPattern = /^[가-힣a-zA-Z\s]+$/;
    if (!validPattern.test(text)) {
      setValidationError("한글 또는 영문만 입력 가능합니다");
      return false;
    }

    // 20글자 제한
    if (text.length > 20) {
      setValidationError("20글자 이하로 입력해주세요");
      return false;
    }

    setValidationError("");
    return true;
  };

  const handleToggleDisease = (disease) => {
    if (selectedDiseases.includes(disease)) {
      setSelectedDiseases(selectedDiseases.filter((d) => d !== disease));
    } else if (selectedDiseases.length < 3) {
      setSelectedDiseases([...selectedDiseases, disease]);
    }
  };

  const handleAddCustomDisease = () => {
    if (customDisease.trim() && selectedDiseases.length < 3) {
      const trimmedDisease = customDisease.trim();

      // 유효성 검증
      if (!isValidDisease(trimmedDisease)) {
        return;
      }

      // 선택 목록에 추가
      if (!selectedDiseases.includes(trimmedDisease)) {
        setSelectedDiseases([...selectedDiseases, trimmedDisease]);
      }

      // 전체 질병 목록에 없으면 추가
      if (!allDiseases.includes(trimmedDisease)) {
        setAllDiseases([...allDiseases, trimmedDisease]);
      }

      setCustomDisease("");
      setValidationError("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleAddCustomDisease();
    }
  };

  const handleSave = async () => {
    if (selectedDiseases.length === 0) {
      alert("질병을 1가지 이상 선택해주셔야 합니다.");
      return;
    }

    // 선택된 질병 저장 (localStorage)
    saveSelectedDiseases(selectedDiseases);
    console.log("질병 정보 저장됨:", selectedDiseases);

    // 🔥 백엔드에 사용자 프로필 동기화
    try {
      await updateUserProfile({ diseases: selectedDiseases });
      console.log("[SelectOption] 백엔드 프로필 동기화 완료");
    } catch (error) {
      console.error("[SelectOption] 백엔드 프로필 동기화 실패:", error);
      // 실패해도 로컬 저장은 완료되었으므로 계속 진행
    }

    if (location.state?.fromSettings) {
      navigate("/settings");
      return;
    }

    // 복용 중인 약이 없을 때만 약 추가 팝업 표시
    if (savedMedicinesCount === 0) {
      setShowMedicineModal(true);
    } else {
      // 이미 약이 등록되어 있으면 바로 메인으로 이동
      setOnboardingComplete(true);
      navigate("/main");
    }
  };

  const handleMedicineYes = () => {
    setShowMedicineModal(false);
    setOnboardingComplete(true);
    navigate("/medicine");
  };

  const handleMedicineNo = () => {
    setShowMedicineModal(false);
    setOnboardingComplete(true);
    navigate("/main");
  };

  return (
    <div className="select-option">
      <div className="select-option__background">
        <div className="select-option__red-shape" />

        <div className="select-option__content">
          <h1 className="select-option__title">
            관심있는 질병을
            <br />
            최대 3가지를 선택해주셔유~
          </h1>

          <div className="select-option__pig-section">
            <img
              src={img_dental}
              alt="Pig"
              className="select-option__pig-image"
            />
            <div className="select-option__input-wrapper">
              <input
                type="text"
                className="select-option__input"
                placeholder="직접입력"
                value={customDisease}
                onChange={(e) => setCustomDisease(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button
                className="select-option__add-button-inside"
                onClick={handleAddCustomDisease}
                disabled={!customDisease.trim() || selectedDiseases.length >= 3}
              >
                추가
              </button>
            </div>
            {validationError && (
              <p className="select-option__error-message">{validationError}</p>
            )}
          </div>

          <div className="select-option__disease-grid">
            {allDiseases.map((disease) => (
              <button
                key={disease}
                className={`select-option__disease-button ${
                  selectedDiseases.includes(disease) ? "selected" : ""
                }`}
                onClick={() => handleToggleDisease(disease)}
              >
                {disease}
              </button>
            ))}
          </div>

          <button className="select-option__save-button" onClick={handleSave}>
            {location.state?.fromSettings ? "수정 완료" : "저장하기"}
          </button>
        </div>
      </div>

      <MedicineAlertModal
        isOpen={showMedicineModal}
        onYes={handleMedicineYes}
        onNo={handleMedicineNo}
      />
    </div>
  );
};

export default SelectOption;
