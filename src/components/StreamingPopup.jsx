import React, { useEffect, useState } from "react";
import "./StreamingPopup.scss";

/**
 * 스트리밍 진행 상태 레이어 팝업
 * - 중앙에 현재 진행 단계 한 줄만 표시
 * - 페이드인 → 표시 → 페이드아웃 애니메이션
 * - 완료 시 자동으로 사라지고 스크롤 최상단 이동
 */
const StreamingPopup = ({
  isOpen,
  title = "AI가 분석 중이에요",
  stages = [],
  progress = 0,
  onComplete,
}) => {
  const [currentStage, setCurrentStage] = useState(null);
  const [fadeClass, setFadeClass] = useState("fade-in");

  // 현재 활성화된 단계 찾기
  useEffect(() => {
    const loadingStage = stages.find((s) => s.status === "loading");
    const lastComplete = [...stages]
      .reverse()
      .find((s) => s.status === "complete");

    const activeStage = loadingStage || lastComplete;

    if (activeStage && activeStage !== currentStage) {
      // 페이드 아웃 → 변경 → 페이드 인
      setFadeClass("fade-out");
      setTimeout(() => {
        setCurrentStage(activeStage);
        setFadeClass("fade-in");
      }, 200);
    }
  }, [stages]);

  // 완료 시 처리
  useEffect(() => {
    if (progress >= 100 && isOpen) {
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
        // 최상단으로 스크롤
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 800);
    }
  }, [progress, isOpen, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="streaming-popup-overlay">
      <div className="streaming-popup">
        {/* 스피너 */}
        <div className="streaming-popup__spinner"></div>

        {/* 타이틀 */}
        <h3 className="streaming-popup__title">{title}</h3>

        {/* 현재 진행 단계 (한 줄만) */}
        <div className={`streaming-popup__stage ${fadeClass}`}>
          {currentStage && (
            <>
              <span className="streaming-popup__stage-icon">
                {currentStage.status === "complete" ? "✅" : "🔄"}
              </span>
              <span className="streaming-popup__stage-name">
                {currentStage.name}
              </span>
            </>
          )}
        </div>

        {/* 진행 바 */}
        <div className="streaming-popup__progress">
          <div className="streaming-popup__progress-bar">
            <div
              className="streaming-popup__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="streaming-popup__progress-text">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default StreamingPopup;
