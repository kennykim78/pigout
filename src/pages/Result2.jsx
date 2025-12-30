import "./Result2.scss";
import imgangry from "../assets/images/img_angry.png";
import imghappy from "../assets/images/img_happy.png";
import imgcook from "../assets/images/img_cook.png";
import img_travel from "../assets/images/img_travel.png";
import img_run from "../assets/images/img_run.png";
import RecommendationCard from "../components/RecommendationCard";
import { AnalysisDashboard } from "../components/AnalysisCharts";
import MedicineComponentRiskCard from "../components/MedicineComponentRiskCard";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { analyzeFoodByTextStream, getMyMedicines } from "../services/api";
import { getDeviceId } from "../utils/deviceId";
import StreamingPopup from "../components/StreamingPopup";

// 🆕 AnalysisTags 컴포넌트
const AnalysisTags = ({ pros, cons }) => {
  return (
    <div className="analysis-tags">
      <div className="analysis-tags__section">
        <h3 className="analysis-tags__title">👍 이래서 좋아요!</h3>
        <div className="analysis-tags__list">
          {pros &&
            pros.map((tag, idx) => (
              <span
                key={idx}
                className="analysis-tags__tag analysis-tags__tag--pro"
              >
                {tag}
              </span>
            ))}
        </div>
      </div>
      <div className="analysis-tags__section">
        <h3 className="analysis-tags__title">👎 이건 조심하세요!</h3>
        <div className="analysis-tags__list">
          {cons &&
            cons.map((tag, idx) => (
              <span
                key={idx}
                className="analysis-tags__tag analysis-tags__tag--con"
              >
                {tag}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
};

// 🆕 SmartRecipeCard 컴포넌트
const SmartRecipeCard = ({ recipe }) => {
  if (!recipe) return null;

  return (
    <div className="smart-recipe-card">
      <h3 className="smart-recipe-card__title">🥗 스마트 레시피</h3>
      {/* 관련 영상이 있을 때만 표시 */}
      {recipe.videoId && (
        <div className="smart-recipe-card__video-wrapper">
          <iframe
            className="smart-recipe-card__video"
            src={`https://www.youtube.com/embed/${recipe.videoId}`}
            title="Healthy Recipe Video"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}
      <div className="smart-recipe-card__content">
        <div className="smart-recipe-card__step">
          <span className="smart-recipe-card__icon">🔄</span>
          <div className="smart-recipe-card__text">
            <strong>재료 대체:</strong>{" "}
            {recipe.substitutes || "특별한 대체 팁 없음"}
          </div>
        </div>
        <div className="smart-recipe-card__step">
          <span className="smart-recipe-card__icon">🍳</span>
          <div className="smart-recipe-card__text">
            <strong>조리법:</strong>{" "}
            {recipe.cookingMethod || "일반적인 조리법 사용"}
          </div>
        </div>
        <div className="smart-recipe-card__step">
          <span className="smart-recipe-card__icon">🍽️</span>
          <div className="smart-recipe-card__text">
            <strong>섭취 가이드:</strong>{" "}
            {recipe.intakeGuide || "적당량 섭취 권장"}
          </div>
        </div>
      </div>
    </div>
  );
};

// 🆕 AlternativeFoodCarousel 컴포넌트
const AlternativeFoodCarousel = ({ alternatives }) => {
  if (!alternatives || alternatives.length === 0) return null;

  return (
    <div className="alternative-food-carousel">
      <h3 className="alternative-food-carousel__title">🔄 대신 이건 어때요?</h3>
      <div className="alternative-food-carousel__container">
        {alternatives.map((item, idx) => (
          <div key={idx} className="alternative-food-card">
            <div className="alternative-food-card__image-wrapper">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="alternative-food-card__image"
                />
              ) : (
                <div className="alternative-food-card__placeholder">
                  <span>{item.name}</span>
                </div>
              )}
            </div>
            <div className="alternative-food-card__content">
              <h4 className="alternative-food-card__name">{item.name}</h4>
              <p className="alternative-food-card__reason">{item.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const imgsorce =
  "https://img.bizthenaum.co.kr/data/img/1000000869/ori/1000000869_11.jpg";

const Result2 = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [foodName, setFoodName] = useState("김치찌개");
  const [foodImage, setFoodImage] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [detailedAnalysis, setDetailedAnalysis] = useState(null);

  // 🆕 스트리밍 관련 상태
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStages, setStreamingStages] = useState([]);
  const [currentStage, setCurrentStage] = useState(null);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [streamError, setStreamError] = useState(null);
  const [streamProgress, setStreamProgress] = useState(0);
  const abortRef = useRef(null);

  // 🆕 Accordion 상태 관리
  const [expandedSections, setExpandedSections] = useState({
    goodPoints: true, // 좋은 점: 기본 확장
    badPoints: true, // 주의할 점: 기본 확장
    warnings: false, // 경고: 기본 접음
    medicines: false, // 약물 상호작용: 기본 접음
    expertAdvice: false, // 전문가 조언: 기본 접음
    cookingTips: false, // 조리법: 기본 접음
    riskFactors: false, // 위험 성분: 기본 접음
    summary: false, // 종합 분석: 기본 접음
  });

  // Accordion 토글 함수
  const toggleSection = (sectionName) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  // 🆕 스트리밍 분석 시작 함수
  const startStreamingAnalysis = async (foodNameParam) => {
    console.log("=== startStreamingAnalysis 호출됨 ===");
    console.log("foodNameParam:", foodNameParam);
    console.log("typeof foodNameParam:", typeof foodNameParam);

    if (!foodNameParam || foodNameParam.trim() === "") {
      console.error("❌ foodNameParam이 비어있음!");
      setStreamError("음식 이름이 없습니다.");
      return;
    }

    // 프론트엔드에서 약 조회는 제거 (백엔드에서 직접 조회)
    console.log("✅ 스트리밍 분석 시작:", foodNameParam);
    setIsStreaming(true);
    setStreamError(null);
    setStreamingStages([]);

    const { abort } = analyzeFoodByTextStream(foodNameParam, {
      onStart: (data) => {
        console.log("[Stream] 시작:", data);
        setStreamingMessage(data.message);
        setStreamingStages(
          data.stages.map((name, idx) => ({
            stage: idx + 1,
            name,
            status: "waiting",
          }))
        );
      },
      onStage: (data) => {
        console.log("[Stream] 단계:", data);
        setCurrentStage(data.stage);
        setStreamingMessage(data.message);

        // 프리뷰 데이터 저장 (약물 상호작용 등)
        if (data.preview) {
          setStreamingStages((prev) =>
            prev.map((s) =>
              s.stage === data.stage
                ? {
                    ...s,
                    status: data.status,
                    message: data.message,
                    preview: data.preview,
                  }
                : s.stage < data.stage
                ? { ...s, status: "complete" }
                : s
            )
          );
        } else {
          setStreamingStages((prev) =>
            prev.map((s) =>
              s.stage === data.stage
                ? { ...s, status: data.status, message: data.message }
                : s.stage < data.stage
                ? { ...s, status: "complete" }
                : s
            )
          );
        }

        // 진행률 계산 (5단계 기준)
        const totalStages = 5;
        const progressPerStage = 100 / totalStages;
        const baseProgress = (data.stage - 1) * progressPerStage;
        const stageProgress =
          data.status === "complete"
            ? progressPerStage
            : progressPerStage * 0.5;
        setStreamProgress(Math.min(baseProgress + stageProgress, 100));
      },
      onPartial: (data) => {
        console.log("[Stream] 부분 데이터:", data.type);
        // 부분 데이터 수신 시 즉시 UI 업데이트
        if (data.type === "interactions") {
          setDetailedAnalysis((prev) => ({
            ...prev,
            medicalAnalysis: data.data,
          }));
        } else if (data.type === "components") {
          setDetailedAnalysis((prev) => ({
            ...prev,
            foodComponents: data.data.foodComponents,
            riskFactors: data.data.riskFactors,
            riskFactorNotes: data.data.riskFactorNotes,
          }));
        }
      },
      onResult: (data) => {
        console.log("[Stream] 최종 결과:", data);
        if (data.success && data.data) {
          setAnalysis(data.data.analysis);
          setDetailedAnalysis(data.data.detailedAnalysis);

          // 🔍 약 정보 디버깅
          console.log("🔍 [Result2] 약 정보 디버깅:");
          console.log(
            "  - drug_food_interactions:",
            data.data.detailedAnalysis?.medicalAnalysis?.drug_food_interactions
          );
          if (
            data.data.detailedAnalysis?.medicalAnalysis?.drug_food_interactions
          ) {
            data.data.detailedAnalysis.medicalAnalysis.drug_food_interactions.forEach(
              (interaction, idx) => {
                console.log(`  [${idx}] ${interaction.medicine_name}:`, {
                  risk_level: interaction.risk_level,
                  interaction_description:
                    interaction.interaction_description?.substring(0, 100),
                  recommendation: interaction.recommendation?.substring(0, 100),
                  components: interaction.components,
                  food_components: interaction.food_components,
                  medicines: interaction.medicines,
                });
              }
            );
          }
        }
        setStreamProgress(100);
        setIsStreaming(false);
        setStreamingMessage("분석 완료!");
      },
      onError: (error) => {
        console.error("[Stream] 오류:", error);
        setStreamError(error.message);
        setIsStreaming(false);
      },
      onComplete: () => {
        console.log("[Stream] 완료");
        setIsStreaming(false);
      },
    });

    abortRef.current = abort;
  };

  useEffect(() => {
    console.log("=== Result2 useEffect 실행 ===");
    console.log("location.state:", location.state);

    // 🔍 약 목록 먼저 조회 (디버깅용)
    const checkMedicines = async () => {
      try {
        const deviceId = getDeviceId();
        console.log("🔍 [Result2 useEffect] Device ID:", deviceId);

        const medicines = await getMyMedicines();
        console.log("🔍 [Result2 useEffect] 등록된 약 목록:", medicines);
        const medicineCount = Array.isArray(medicines) ? medicines.length : 0;
        console.log("🔍 [Result2 useEffect] 약 개수:", medicineCount);
        if (medicineCount > 0) {
          medicines.forEach((med, idx) => {
            console.log(`  [${idx}] ${med.itemName}:`, {
              entpName: med.entpName,
              itemSeq: med.itemSeq,
              efcyQesitm: med.efcyQesitm?.substring(0, 50),
              hasDetails: !!(
                med.useMethodQesitm ||
                med.atpnWarnQesitm ||
                med.intrcQesitm
              ),
            });
          });
        } else {
          console.warn("⚠️ [Result2 useEffect] 등록된 약이 없습니다!");
        }
      } catch (error) {
        console.error("❌ [Result2 useEffect] 약 목록 조회 실패:", error);
      }
    };
    checkMedicines();

    if (location.state) {
      if (location.state.foodName) {
        console.log("✅ foodName 설정:", location.state.foodName);
        setFoodName(location.state.foodName);
      }

      // 이미지 처리
      let blobUrl = null;
      if (location.state.foodImage) {
        blobUrl = URL.createObjectURL(location.state.foodImage);
        setFoodImage(blobUrl);
      } else if (location.state.imageUrl) {
        console.log("✅ imageUrl 설정:", location.state.imageUrl);
        setFoodImage(location.state.imageUrl);
      }

      if (location.state.analysis) {
        console.log("✅ analysis 설정");
        setAnalysis(location.state.analysis);
      }

      // 🆕 스트리밍 모드 체크
      // Result2는 상세 분석 페이지이므로, "진짜" 상세 분석 데이터가 있을 때만 스킵
      // 1차 분석(pros/cons 문자열)은 간편 분석이므로, 상세 분석을 다시 받아야 함
      const da = location.state.detailedAnalysis;

      // 상세 분석 데이터 체크 (배열 형태의 데이터가 있어야 진짜 상세 분석)
      const hasRealDetailedAnalysis =
        da &&
        ((da.goodPoints &&
          Array.isArray(da.goodPoints) &&
          da.goodPoints.length > 0) ||
          (da.badPoints &&
            Array.isArray(da.badPoints) &&
            da.badPoints.length > 0) ||
          da.medicalAnalysis?.drug_food_interactions?.length > 0);

      // 1차 분석 데이터만 있는 경우 (문자열 형태) - 상세 분석 필요
      const hasOnlyQuickAnalysis =
        da && !hasRealDetailedAnalysis && (da.pros || da.cons || da.summary);

      console.log("📊 detailedAnalysis 검사:", {
        exists: !!da,
        hasRealDetailed: hasRealDetailedAnalysis,
        hasOnlyQuick: hasOnlyQuickAnalysis,
        hasGoodPoints: da?.goodPoints?.length > 0,
        hasBadPoints: da?.badPoints?.length > 0,
        hasPros: !!da?.pros,
        hasCons: !!da?.cons,
        rawData: da,
      });

      console.log("=== 스트리밍 분기 판단 ===");
      console.log("hasRealDetailedAnalysis:", hasRealDetailedAnalysis);
      console.log("location.state.foodName:", location.state.foodName);

      if (hasRealDetailedAnalysis) {
        // 진짜 상세 분석 데이터가 있으면 그대로 사용
        console.log("✅ 상세 분석 데이터 있음, 스트리밍 스킵");
        setDetailedAnalysis(da);
      } else if (location.state.foodName) {
        // 상세 분석 데이터가 없으면 (1차 분석만 있거나 아예 없으면) 스트리밍 시작
        console.log("🚀 상세 분석 시작! (1차 분석만 있거나 데이터 없음)");
        console.log("→ startStreamingAnalysis 호출 직전");
        startStreamingAnalysis(location.state.foodName);
        console.log("→ startStreamingAnalysis 호출 완료");
      } else {
        console.warn("⚠️ foodName이 없어서 스트리밍을 시작할 수 없습니다");
      }

      // cleanup 함수: blob URL 해제 및 스트리밍 중단
      return () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
        if (abortRef.current) {
          abortRef.current();
        }
      };
    } else {
      console.error("❌ location.state 자체가 없음!");
    }
  }, [location.state]);

  // 좋은점 구성 (✅ 좋은 점)
  const getGoodPoints = () => {
    console.log("🟢 getGoodPoints 호출");
    console.log("  detailedAnalysis:", detailedAnalysis);

    const sections = [];

    // 1. AI가 분석한 음식과 질병의 좋은점 (goodPoints)
    if (
      detailedAnalysis?.goodPoints &&
      Array.isArray(detailedAnalysis.goodPoints) &&
      detailedAnalysis.goodPoints.length > 0
    ) {
      sections.push("【 ✅ 좋은 점 】");
      detailedAnalysis.goodPoints.forEach((point, idx) => {
        // 이미 이모지가 포함되어 있으면 그대로, 아니면 추가
        const formattedPoint = point.startsWith("✅") ? point : `✅ ${point}`;
        sections.push(`• ${formattedPoint.replace(/^✅\s*/, "")}`);
      });
      sections.push("");
    }

    // 2. 복용중인 약과의 시너지 효과
    if (detailedAnalysis?.medicalAnalysis?.drug_food_interactions) {
      const safeDrugs =
        detailedAnalysis.medicalAnalysis.drug_food_interactions.filter(
          (d) => d.risk_level === "safe" && d.interaction_description
        );

      if (safeDrugs.length > 0) {
        sections.push("【 💊 복용중인 약과의 시너지 효과 】");
        safeDrugs.forEach((drug, idx) => {
          sections.push(`• ${drug.medicine_name}`);
          if (drug.interaction_description) {
            sections.push(`   ${drug.interaction_description}`);
          }
        });
        sections.push("");
      }
    }

    if (sections.length > 0) {
      return sections.join("\n");
    }

    return "균형 잡힌 식단의 일부로 적당히 섭취하세요.";
  };

  // 안좋은점 구성 (⚠️ 주의할 점)
  const getBadPoints = () => {
    console.log("🔴 getBadPoints 호출");
    console.log("  detailedAnalysis:", detailedAnalysis);

    const sections = [];

    // 1. AI가 분석한 주의사항 (badPoints)
    if (
      detailedAnalysis?.badPoints &&
      Array.isArray(detailedAnalysis.badPoints) &&
      detailedAnalysis.badPoints.length > 0
    ) {
      sections.push("【 ⚠️ 주의할 점 】");
      detailedAnalysis.badPoints.forEach((point, idx) => {
        const formattedPoint = point.startsWith("⚠️") ? point : `⚠️ ${point}`;
        sections.push(`• ${formattedPoint.replace(/^⚠️\s*/, "")}`);
      });
      sections.push("");
    }

    // 2. 경고사항 (warnings) - 새로 추가
    if (
      detailedAnalysis?.warnings &&
      Array.isArray(detailedAnalysis.warnings) &&
      detailedAnalysis.warnings.length > 0
    ) {
      sections.push("【 🚨 경고 】");
      detailedAnalysis.warnings.forEach((warning, idx) => {
        const formattedWarning = warning.startsWith("🚨")
          ? warning
          : `🚨 ${warning}`;
        sections.push(`• ${formattedWarning.replace(/^🚨\s*/, "")}`);
      });
      sections.push("");
    }

    // 3. 복용중인 약과의 상관관계 (위험/주의 등급)
    if (detailedAnalysis?.medicalAnalysis?.drug_food_interactions) {
      const interactions =
        detailedAnalysis.medicalAnalysis.drug_food_interactions;
      const dangerDrugs = interactions.filter((d) => d.risk_level === "danger");
      const cautionDrugs = interactions.filter(
        (d) => d.risk_level === "caution"
      );

      if (dangerDrugs.length > 0) {
        sections.push("【 🚨 위험 약물 상호작용 】");
        dangerDrugs.forEach((drug, idx) => {
          const components = drug.matched_components?.join(", ") || "";
          sections.push(
            `• ${drug.medicine_name}${components ? ` [${components}]` : ""}`
          );
          if (drug.interaction_description) {
            sections.push(`   ${drug.interaction_description}`);
          }
          if (drug.recommendation) {
            sections.push(`   💡 ${drug.recommendation}`);
          }
        });
        sections.push("");
      }

      if (cautionDrugs.length > 0) {
        sections.push("【 ⚠️ 주의 약물 상호작용 】");
        cautionDrugs.forEach((drug, idx) => {
          const components = drug.matched_components?.join(", ") || "";
          sections.push(
            `• ${drug.medicine_name}${components ? ` [${components}]` : ""}`
          );
          if (drug.interaction_description) {
            sections.push(`   ${drug.interaction_description}`);
          }
          if (drug.recommendation) {
            sections.push(`   💡 ${drug.recommendation}`);
          }
        });
        sections.push("");
      }
    }

    if (sections.length > 0) {
      return sections.join("\n");
    }

    return "특별히 주의할 점은 발견되지 않았습니다.";
  };

  // 전문가 조언 (💊 AI 전문가 조언) - 새로 추가
  const getExpertAdvice = () => {
    if (detailedAnalysis?.expertAdvice) {
      return detailedAnalysis.expertAdvice.startsWith("💊")
        ? detailedAnalysis.expertAdvice
        : `💊 ${detailedAnalysis.expertAdvice}`;
    }
    return "💊 균형 잡힌 식단의 일부로 적당량 섭취하시면 건강에 도움이 됩니다.";
  };

  // 종합 분석 (🔬 최종 종합 분석)
  const getFinalSummary = () => {
    if (detailedAnalysis?.summary) {
      return detailedAnalysis.summary.startsWith("🔬")
        ? detailedAnalysis.summary
        : `🔬 ${detailedAnalysis.summary}`;
    }
    return analysis || `${foodName}에 대한 분석이 완료되었습니다.`;
  };

  const getCookingTips = () => {
    console.log("🔵 getCookingTips 호출");
    console.log("  detailedAnalysis:", detailedAnalysis);
    console.log(
      "  detailedAnalysis?.cookingTips:",
      detailedAnalysis?.cookingTips
    );

    if (
      detailedAnalysis &&
      detailedAnalysis.cookingTips &&
      Array.isArray(detailedAnalysis.cookingTips) &&
      detailedAnalysis.cookingTips.length > 0
    ) {
      console.log(
        "✅ cookingTips 배열 발견, 길이:",
        detailedAnalysis.cookingTips.length
      );

      return detailedAnalysis.cookingTips
        .map((tipItem, idx) => {
          // tipItem이 객체인 경우 (category, tip 구조)
          if (typeof tipItem === "object" && tipItem !== null) {
            const category = tipItem.category || "";
            const tipText = tipItem.tip || "";
            return `${idx + 1}. ${category ? category + " " : ""}${tipText}`;
          }
          // tipItem이 문자열인 경우
          return `${idx + 1}. ${tipItem}`;
        })
        .join("\n\n");
    }

    console.log("⚠️ cookingTips 배열 없음, 기본 텍스트 반환");
    return `✅ 신선한 재료를 사용하세요\n\n✅ 조리 시 염분과 당분을 적게 사용하세요\n\n✅ 채소를 많이 추가하면 더 건강해요`;
  };

  const getDataSources = () => {
    // 모든 공공데이터 출처 표시
    const allSources = [
      "식품의약품안전처 의약품 DB",
      "식품의약품안전처 영양성분 DB",
      "건강기능식품 기능성 DB",
      "질병관리본부 질병 정보",
      "약물-음식 상호작용 DB",
      "AI 분석 결과",
    ];
    return allSources.join(" / ");
  };

  const riskFactorLabels = {
    alcohol: "알코올",
    highSodium: "고나트륨",
    highPotassium: "고칼륨",
    caffeine: "카페인",
    citrus: "감귤류",
    grapefruit: "자몽",
    dairy: "유제품",
    highFat: "고지방",
    vitaminK: "비타민K",
    tyramine: "티라민",
  };

  const formatRiskFactorKey = (key) => {
    if (riskFactorLabels[key]) return riskFactorLabels[key];
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (char) => char.toUpperCase())
      .trim();
  };

  const getRiskFactorEntries = () => {
    if (!detailedAnalysis?.riskFactorNotes) return [];
    const riskFactors = detailedAnalysis.riskFactors || {};
    return Object.entries(detailedAnalysis.riskFactorNotes)
      .filter(([, note]) => note && note.trim())
      .map(([key, note]) => ({
        key,
        label: formatRiskFactorKey(key),
        note: note.trim(),
        active: riskFactors[key] !== false,
      }))
      .sort((a, b) => {
        if (a.active === b.active) {
          return a.label.localeCompare(b.label, "ko");
        }
        return a.active ? -1 : 1;
      });
  };

  const getSummaryParagraphs = () => {
    const summaryText = detailedAnalysis?.summary || analysis || "";
    return summaryText
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  };

  const riskFactorEntries = getRiskFactorEntries();
  const summaryParagraphs = getSummaryParagraphs();

  return (
    <div className="result2">
      <div className="result2__header">
        <button className="result2__back-btn" onClick={() => navigate(-1)}>
          <span className="material-symbols-rounded">arrow_back</span>
        </button>
        <h1 className="result2__food-name">[ {foodName} ]</h1>
        <p className="result2__question">
          {isStreaming ? "분석 중이돼지..." : "자세히 분석했돼지!"}
        </p>
        {foodImage ? (
          <img src={foodImage} alt={foodName} className="result2__header-bg" />
        ) : (
          <div className="result2__header-bg result2__header-bg--placeholder">
            <span>{foodName}</span>
          </div>
        )}
      </div>

      {/* 🆕 스트리밍 분석 레이어 팝업 */}
      <StreamingPopup
        isOpen={isStreaming}
        title="AI가 상세 분석 중이에요"
        stages={streamingStages}
        progress={streamProgress}
        onComplete={() => setIsStreaming(false)}
      />

      {/* 에러 표시 */}
      {/* 에러 표시 */}
      {streamError && (
        <div className="result2__error-section">
          <p className="result2__error-message">⚠️ {streamError}</p>
          <button
            className="result2__retry-btn"
            onClick={() => startStreamingAnalysis(foodName)}
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 분석 데이터 없음 처리 */}
      {!isStreaming && !detailedAnalysis && !streamError && (
        <div className="result2__error-section">
          <p className="result2__error-message">
            ⚠️ 분석 결과를 불러오지 못했습니다.
          </p>
          <button
            className="result2__retry-btn"
            onClick={() => startStreamingAnalysis(foodName)}
          >
            다시 시도
          </button>
        </div>
      )}

      {!isStreaming && detailedAnalysis && (
        <div className="result2__main-content">
          {/* 1. 영양성분정보 + 2. 분석결과요약 + 3. 약물상호작용현황 + 3-2. 위험성분분석 (AnalysisDashboard) */}
          <AnalysisDashboard detailedAnalysis={detailedAnalysis} />

          {/* 2-1. 장단점 (이래서좋아요, 이건조심하세요) */}
          <AnalysisTags
            pros={detailedAnalysis.pros || detailedAnalysis.goodPoints}
            cons={detailedAnalysis.cons || detailedAnalysis.badPoints}
          />

          {/* 3-1. 약물 상호작용 주의 (상세 목록 - 위험할 때만 표시) */}
          {detailedAnalysis.medicalAnalysis?.drug_food_interactions?.some(
            (d) => d.risk_level === "danger" || d.risk_level === "caution"
          ) && (
            <div className="result2__accordion">
              <button
                className={`result2__accordion-toggle result2__accordion-toggle--medicines`}
                onClick={() => toggleSection("medicines")}
              >
                <span className="result2__accordion-icon">⚠️</span>
                <span className="result2__accordion-title">
                  약물 상호작용 주의
                </span>
                <span
                  className={`result2__accordion-chevron ${
                    expandedSections.medicines ? "expanded" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {expandedSections.medicines && (
                <div className="result2__accordion-content">
                  <div className="result2__medicine-list">
                    {detailedAnalysis.medicalAnalysis.drug_food_interactions
                      .filter(
                        (d) =>
                          d.risk_level === "danger" ||
                          d.risk_level === "caution"
                      )
                      .map((drug, idx) => (
                        <div
                          key={idx}
                          className={`result2__medicine-card result2__medicine-card--${drug.risk_level}`}
                        >
                          <div className="result2__medicine-header">
                            <span className="result2__medicine-name">
                              {drug.medicine_name}
                            </span>
                            <span
                              className={`result2__risk-badge result2__risk-badge--${drug.risk_level}`}
                            >
                              {drug.risk_level === "danger" ? "위험" : "주의"}
                            </span>
                          </div>
                          {drug.description && (
                            <p className="result2__medicine-desc">
                              {drug.description}
                            </p>
                          )}
                          {drug.recommendation && (
                            <p className="result2__medicine-recommend">
                              💡 {drug.recommendation}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. 스마트 레시피 */}
          <SmartRecipeCard recipe={detailedAnalysis.recipe} />

          {/* 5. 대신 이건 어때요? */}
          <AlternativeFoodCarousel
            alternatives={detailedAnalysis.alternatives}
          />

          {/* 6. 종합 분석 */}
          <div className="result2__summary-section">
            <h3 className="result2__summary-title">
              <span className="result2__summary-icon">🎓</span>
              종합 분석
            </h3>
            <p className="result2__summary-content">
              {detailedAnalysis.summary || detailedAnalysis.expertAdvice}
            </p>
          </div>

          <div className="result2__disclaimer">
            <p>
              ※ 본 결과는 AI 분석 및 공공데이터를 기반으로 하며, 의학적 진단을
              대체할 수 없습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Result2;
