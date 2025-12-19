import './Result2.scss';
import imgangry from '../assets/images/img_angry.png';
import imghappy from '../assets/images/img_happy.png';
import imgcook from '../assets/images/img_cook.png';
import img_travel from '../assets/images/img_travel.png';
import img_run from '../assets/images/img_run.png';
import RecommendationCard from '../components/RecommendationCard';
import { AnalysisDashboard } from '../components/AnalysisCharts';
import FoodDrugInteractionMatrix from '../components/FoodDrugInteractionMatrix';
import MedicineComponentRiskCard from '../components/MedicineComponentRiskCard';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { analyzeFoodByTextStream, getMyMedicines } from '../services/api';
import { getDeviceId } from '../utils/deviceId';

const imgsorce = 'https://img.bizthenaum.co.kr/data/img/1000000869/ori/1000000869_11.jpg';

const Result2 = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [foodName, setFoodName] = useState('김치찌개');
  const [foodImage, setFoodImage] = useState(null);
  const [analysis, setAnalysis] = useState('');
  const [detailedAnalysis, setDetailedAnalysis] = useState(null);
  
  // 🆕 스트리밍 관련 상태
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStages, setStreamingStages] = useState([]);
  const [currentStage, setCurrentStage] = useState(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamError, setStreamError] = useState(null);
  const [streamProgress, setStreamProgress] = useState(0);
  const abortRef = useRef(null);

  // 🆕 Accordion 상태 관리
  const [expandedSections, setExpandedSections] = useState({
    goodPoints: true,      // 좋은 점: 기본 확장
    badPoints: true,       // 주의할 점: 기본 확장
    warnings: false,       // 경고: 기본 접음
    medicines: false,      // 약물 상호작용: 기본 접음
    expertAdvice: false,   // 전문가 조언: 기본 접음
    cookingTips: false,    // 조리법: 기본 접음
    riskFactors: false,    // 위험 성분: 기본 접음
    summary: false,        // 종합 분석: 기본 접음
  });

  // Accordion 토글 함수
  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  // 🆕 스트리밍 분석 시작 함수
  const startStreamingAnalysis = async (foodNameParam) => {
    console.log('=== startStreamingAnalysis 호출됨 ===');
    console.log('foodNameParam:', foodNameParam);
    console.log('typeof foodNameParam:', typeof foodNameParam);
    
    if (!foodNameParam || foodNameParam.trim() === '') {
      console.error('❌ foodNameParam이 비어있음!');
      setStreamError('음식 이름이 없습니다.');
      return;
    }
    
    // 프론트엔드에서 약 조회는 제거 (백엔드에서 직접 조회)
    console.log('✅ 스트리밍 분석 시작:', foodNameParam);
    setIsStreaming(true);
    setStreamError(null);
    setStreamingStages([]);
    
    const { abort } = analyzeFoodByTextStream(foodNameParam, {
      onStart: (data) => {
        console.log('[Stream] 시작:', data);
        setStreamingMessage(data.message);
        setStreamingStages(data.stages.map((name, idx) => ({
          stage: idx + 1,
          name,
          status: 'waiting'
        })));
      },
      onStage: (data) => {
        console.log('[Stream] 단계:', data);
        setCurrentStage(data.stage);
        setStreamingMessage(data.message);
        
        // 프리뷰 데이터 저장 (약물 상호작용 등)
        if (data.preview) {
          setStreamingStages(prev => prev.map(s => 
            s.stage === data.stage 
              ? { ...s, status: data.status, message: data.message, preview: data.preview }
              : s.stage < data.stage 
                ? { ...s, status: 'complete' }
                : s
          ));
        } else {
          setStreamingStages(prev => prev.map(s => 
            s.stage === data.stage 
              ? { ...s, status: data.status, message: data.message }
              : s.stage < data.stage 
                ? { ...s, status: 'complete' }
                : s
          ));
        }
        
        // 진행률 계산 (5단계 기준)
        const totalStages = 5;
        const progressPerStage = 100 / totalStages;
        const baseProgress = (data.stage - 1) * progressPerStage;
        const stageProgress = data.status === 'complete' ? progressPerStage : progressPerStage * 0.5;
        setStreamProgress(Math.min(baseProgress + stageProgress, 100));
      },
      onPartial: (data) => {
        console.log('[Stream] 부분 데이터:', data.type);
        // 부분 데이터 수신 시 즉시 UI 업데이트
        if (data.type === 'interactions') {
          setDetailedAnalysis(prev => ({
            ...prev,
            medicalAnalysis: data.data
          }));
        } else if (data.type === 'components') {
          setDetailedAnalysis(prev => ({
            ...prev,
            foodComponents: data.data.foodComponents,
            riskFactors: data.data.riskFactors,
            riskFactorNotes: data.data.riskFactorNotes,
          }));
        }
      },
      onResult: (data) => {
        console.log('[Stream] 최종 결과:', data);
        if (data.success && data.data) {
          setAnalysis(data.data.analysis);
          setDetailedAnalysis(data.data.detailedAnalysis);
          
          // 🔍 약 정보 디버깅
          console.log('🔍 [Result2] 약 정보 디버깅:');
          console.log('  - drug_food_interactions:', data.data.detailedAnalysis?.medicalAnalysis?.drug_food_interactions);
          if (data.data.detailedAnalysis?.medicalAnalysis?.drug_food_interactions) {
            data.data.detailedAnalysis.medicalAnalysis.drug_food_interactions.forEach((interaction, idx) => {
              console.log(`  [${idx}] ${interaction.medicine_name}:`, {
                risk_level: interaction.risk_level,
                interaction_description: interaction.interaction_description?.substring(0, 100),
                recommendation: interaction.recommendation?.substring(0, 100),
                components: interaction.components,
                food_components: interaction.food_components,
                medicines: interaction.medicines,
              });
            });
          }
        }
        setStreamProgress(100);
        setIsStreaming(false);
        setStreamingMessage('분석 완료!');
      },
      onError: (error) => {
        console.error('[Stream] 오류:', error);
        setStreamError(error.message);
        setIsStreaming(false);
      },
      onComplete: () => {
        console.log('[Stream] 완료');
        setIsStreaming(false);
      }
    });

    abortRef.current = abort;
  };

  useEffect(() => {
    console.log('=== Result2 useEffect 실행 ===');
    console.log('location.state:', location.state);
    
    // 🔍 약 목록 먼저 조회 (디버깅용)
    const checkMedicines = async () => {
      try {
        const deviceId = getDeviceId();
        console.log('🔍 [Result2 useEffect] Device ID:', deviceId);
        
        const medicines = await getMyMedicines();
        console.log('🔍 [Result2 useEffect] 등록된 약 목록:', medicines);
        const medicineCount = Array.isArray(medicines) ? medicines.length : 0;
        console.log('🔍 [Result2 useEffect] 약 개수:', medicineCount);
        if (medicineCount > 0) {
          medicines.forEach((med, idx) => {
            console.log(`  [${idx}] ${med.itemName}:`, {
              entpName: med.entpName,
              itemSeq: med.itemSeq,
              efcyQesitm: med.efcyQesitm?.substring(0, 50),
              hasDetails: !!(med.useMethodQesitm || med.atpnWarnQesitm || med.intrcQesitm)
            });
          });
        } else {
          console.warn('⚠️ [Result2 useEffect] 등록된 약이 없습니다!');
        }
      } catch (error) {
        console.error('❌ [Result2 useEffect] 약 목록 조회 실패:', error);
      }
    };
    checkMedicines();
    
    if (location.state) {
      if (location.state.foodName) {
        console.log('✅ foodName 설정:', location.state.foodName);
        setFoodName(location.state.foodName);
      }
      
      // 이미지 처리
      let blobUrl = null;
      if (location.state.foodImage) {
        blobUrl = URL.createObjectURL(location.state.foodImage);
        setFoodImage(blobUrl);
      } else if (location.state.imageUrl) {
        console.log('✅ imageUrl 설정:', location.state.imageUrl);
        setFoodImage(location.state.imageUrl);
      }
      
      if (location.state.analysis) {
        console.log('✅ analysis 설정');
        setAnalysis(location.state.analysis);
      }
      
      // 🆕 스트리밍 모드 체크
      // Result2는 상세 분석 페이지이므로, "진짜" 상세 분석 데이터가 있을 때만 스킵
      // 1차 분석(pros/cons 문자열)은 간편 분석이므로, 상세 분석을 다시 받아야 함
      const da = location.state.detailedAnalysis;
      
      // 상세 분석 데이터 체크 (배열 형태의 데이터가 있어야 진짜 상세 분석)
      const hasRealDetailedAnalysis = da && (
        (da.goodPoints && Array.isArray(da.goodPoints) && da.goodPoints.length > 0) ||
        (da.badPoints && Array.isArray(da.badPoints) && da.badPoints.length > 0) ||
        da.medicalAnalysis?.drug_food_interactions?.length > 0
      );
      
      // 1차 분석 데이터만 있는 경우 (문자열 형태) - 상세 분석 필요
      const hasOnlyQuickAnalysis = da && !hasRealDetailedAnalysis && (da.pros || da.cons || da.summary);
      
      console.log('📊 detailedAnalysis 검사:', {
        exists: !!da,
        hasRealDetailed: hasRealDetailedAnalysis,
        hasOnlyQuick: hasOnlyQuickAnalysis,
        hasGoodPoints: da?.goodPoints?.length > 0,
        hasBadPoints: da?.badPoints?.length > 0,
        hasPros: !!da?.pros,
        hasCons: !!da?.cons,
        rawData: da,
      });
      
      console.log('=== 스트리밍 분기 판단 ===');
      console.log('hasRealDetailedAnalysis:', hasRealDetailedAnalysis);
      console.log('location.state.foodName:', location.state.foodName);

      if (hasRealDetailedAnalysis) {
        // 진짜 상세 분석 데이터가 있으면 그대로 사용
        console.log('✅ 상세 분석 데이터 있음, 스트리밍 스킵');
        setDetailedAnalysis(da);
      } else if (location.state.foodName) {
        // 상세 분석 데이터가 없으면 (1차 분석만 있거나 아예 없으면) 스트리밍 시작
        console.log('🚀 상세 분석 시작! (1차 분석만 있거나 데이터 없음)');
        console.log('→ startStreamingAnalysis 호출 직전');
        startStreamingAnalysis(location.state.foodName);
        console.log('→ startStreamingAnalysis 호출 완료');
      } else {
        console.warn('⚠️ foodName이 없어서 스트리밍을 시작할 수 없습니다');
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
      console.error('❌ location.state 자체가 없음!');
    }
  }, [location.state]);

  // 좋은점 구성 (✅ 좋은 점)
  const getGoodPoints = () => {
    console.log('🟢 getGoodPoints 호출');
    console.log('  detailedAnalysis:', detailedAnalysis);
    
    const sections = [];
    
    // 1. AI가 분석한 음식과 질병의 좋은점 (goodPoints)
    if (detailedAnalysis?.goodPoints && Array.isArray(detailedAnalysis.goodPoints) && detailedAnalysis.goodPoints.length > 0) {
      sections.push('【 ✅ 좋은 점 】');
      detailedAnalysis.goodPoints.forEach((point, idx) => {
        // 이미 이모지가 포함되어 있으면 그대로, 아니면 추가
        const formattedPoint = point.startsWith('✅') ? point : `✅ ${point}`;
        sections.push(`• ${formattedPoint.replace(/^✅\s*/, '')}`);
      });
      sections.push('');
    }
    
    // 2. 복용중인 약과의 시너지 효과
    if (detailedAnalysis?.medicalAnalysis?.drug_food_interactions) {
      const safeDrugs = detailedAnalysis.medicalAnalysis.drug_food_interactions
        .filter(d => d.risk_level === 'safe' && d.interaction_description);
      
      if (safeDrugs.length > 0) {
        sections.push('【 💊 복용중인 약과의 시너지 효과 】');
        safeDrugs.forEach((drug, idx) => {
          sections.push(`• ${drug.medicine_name}`);
          if (drug.interaction_description) {
            sections.push(`   ${drug.interaction_description}`);
          }
        });
        sections.push('');
      }
    }
    
    if (sections.length > 0) {
      return sections.join('\n');
    }
    
    return '균형 잡힌 식단의 일부로 적당히 섭취하세요.';
  };

  // 안좋은점 구성 (⚠️ 주의할 점)
  const getBadPoints = () => {
    console.log('🔴 getBadPoints 호출');
    console.log('  detailedAnalysis:', detailedAnalysis);
    
    const sections = [];
    
    // 1. AI가 분석한 주의사항 (badPoints)
    if (detailedAnalysis?.badPoints && Array.isArray(detailedAnalysis.badPoints) && detailedAnalysis.badPoints.length > 0) {
      sections.push('【 ⚠️ 주의할 점 】');
      detailedAnalysis.badPoints.forEach((point, idx) => {
        const formattedPoint = point.startsWith('⚠️') ? point : `⚠️ ${point}`;
        sections.push(`• ${formattedPoint.replace(/^⚠️\s*/, '')}`);
      });
      sections.push('');
    }
    
    // 2. 경고사항 (warnings) - 새로 추가
    if (detailedAnalysis?.warnings && Array.isArray(detailedAnalysis.warnings) && detailedAnalysis.warnings.length > 0) {
      sections.push('【 🚨 경고 】');
      detailedAnalysis.warnings.forEach((warning, idx) => {
        const formattedWarning = warning.startsWith('🚨') ? warning : `🚨 ${warning}`;
        sections.push(`• ${formattedWarning.replace(/^🚨\s*/, '')}`);
      });
      sections.push('');
    }
    
    // 3. 복용중인 약과의 상관관계 (위험/주의 등급)
    if (detailedAnalysis?.medicalAnalysis?.drug_food_interactions) {
      const interactions = detailedAnalysis.medicalAnalysis.drug_food_interactions;
      const dangerDrugs = interactions.filter(d => d.risk_level === 'danger');
      const cautionDrugs = interactions.filter(d => d.risk_level === 'caution');
      
      if (dangerDrugs.length > 0) {
        sections.push('【 🚨 위험 약물 상호작용 】');
        dangerDrugs.forEach((drug, idx) => {
          const components = drug.matched_components?.join(', ') || '';
          sections.push(`• ${drug.medicine_name}${components ? ` [${components}]` : ''}`);
          if (drug.interaction_description) {
            sections.push(`   ${drug.interaction_description}`);
          }
          if (drug.recommendation) {
            sections.push(`   💡 ${drug.recommendation}`);
          }
        });
        sections.push('');
      }
      
      if (cautionDrugs.length > 0) {
        sections.push('【 ⚠️ 주의 약물 상호작용 】');
        cautionDrugs.forEach((drug, idx) => {
          const components = drug.matched_components?.join(', ') || '';
          sections.push(`• ${drug.medicine_name}${components ? ` [${components}]` : ''}`);
          if (drug.interaction_description) {
            sections.push(`   ${drug.interaction_description}`);
          }
          if (drug.recommendation) {
            sections.push(`   💡 ${drug.recommendation}`);
          }
        });
        sections.push('');
      }
    }
    
    if (sections.length > 0) {
      return sections.join('\n');
    }
    
    return '특별히 주의할 점은 발견되지 않았습니다.';
  };

  // 전문가 조언 (💊 AI 전문가 조언) - 새로 추가
  const getExpertAdvice = () => {
    if (detailedAnalysis?.expertAdvice) {
      return detailedAnalysis.expertAdvice.startsWith('💊') 
        ? detailedAnalysis.expertAdvice 
        : `💊 ${detailedAnalysis.expertAdvice}`;
    }
    return '💊 균형 잡힌 식단의 일부로 적당량 섭취하시면 건강에 도움이 됩니다.';
  };

  // 종합 분석 (🔬 최종 종합 분석)
  const getFinalSummary = () => {
    if (detailedAnalysis?.summary) {
      return detailedAnalysis.summary.startsWith('🔬') 
        ? detailedAnalysis.summary 
        : `🔬 ${detailedAnalysis.summary}`;
    }
    return analysis || `${foodName}에 대한 분석이 완료되었습니다.`;
  };

  const getCookingTips = () => {
    console.log('🔵 getCookingTips 호출');
    console.log('  detailedAnalysis:', detailedAnalysis);
    console.log('  detailedAnalysis?.cookingTips:', detailedAnalysis?.cookingTips);
    
    if (detailedAnalysis && detailedAnalysis.cookingTips && Array.isArray(detailedAnalysis.cookingTips) && detailedAnalysis.cookingTips.length > 0) {
      console.log('✅ cookingTips 배열 발견, 길이:', detailedAnalysis.cookingTips.length);
      
      return detailedAnalysis.cookingTips.map((tipItem, idx) => {
        // tipItem이 객체인 경우 (category, tip 구조)
        if (typeof tipItem === 'object' && tipItem !== null) {
          const category = tipItem.category || '';
          const tipText = tipItem.tip || '';
          return `${idx + 1}. ${category ? category + ' ' : ''}${tipText}`;
        }
        // tipItem이 문자열인 경우
        return `${idx + 1}. ${tipItem}`;
      }).join('\n\n');
    }
    
    console.log('⚠️ cookingTips 배열 없음, 기본 텍스트 반환');
    return `✅ 신선한 재료를 사용하세요\n\n✅ 조리 시 염분과 당분을 적게 사용하세요\n\n✅ 채소를 많이 추가하면 더 건강해요`;
  };

  const getDataSources = () => {
    if (detailedAnalysis && detailedAnalysis.dataSources && detailedAnalysis.dataSources.length > 0) {
      return detailedAnalysis.dataSources.join(' / ');
    }
    return 'AI 분석 결과 / 식품의약품안전처 영양성분 DB';
  };

  const riskFactorLabels = {
    alcohol: '알코올',
    highSodium: '고나트륨',
    highPotassium: '고칼륨',
    caffeine: '카페인',
    citrus: '감귤류',
    grapefruit: '자몽',
    dairy: '유제품',
    highFat: '고지방',
    vitaminK: '비타민K',
    tyramine: '티라민',
  };

  const formatRiskFactorKey = (key) => {
    if (riskFactorLabels[key]) return riskFactorLabels[key];
    return key
      .replace(/([A-Z])/g, ' $1')
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
          return a.label.localeCompare(b.label, 'ko');
        }
        return a.active ? -1 : 1;
      });
  };

  const getSummaryParagraphs = () => {
    const summaryText = detailedAnalysis?.summary || analysis || '';
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
        <p className="result2__question">{isStreaming ? '분석 중이돼지...' : '자세히 분석했돼지!'}</p>
        {foodImage ? (
          <img src={foodImage} alt={foodName} className="result2__header-bg"/>
        ) : (
          <div className="result2__header-bg result2__header-bg--placeholder">
            <span>{foodName}</span>
          </div>
        )}
      </div>

      {/* 🆕 스트리밍 진행 상태 표시 - 카드형 */}
      {isStreaming && (
        <div className="result2__streaming-section">
          <div className="result2__streaming-header">
            <div className="result2__streaming-spinner"></div>
            <div className="result2__streaming-info">
              <p className="result2__streaming-title">AI가 분석 중이에요</p>
              <p className="result2__streaming-message">{streamingMessage}</p>
            </div>
          </div>
          
          {/* 진행 바 */}
          <div className="result2__streaming-progress">
            <div className="result2__streaming-progress-bar">
              <div 
                className="result2__streaming-progress-fill" 
                style={{ width: `${streamProgress}%` }}
              />
            </div>
            <span className="result2__streaming-progress-text">{Math.round(streamProgress)}%</span>
          </div>
          
          {/* 단계별 상태 */}
          <div className="result2__streaming-stages">
            {streamingStages.map((stage) => (
              <div 
                key={stage.stage} 
                className={`result2__streaming-stage result2__streaming-stage--${stage.status}`}
              >
                <span className="result2__streaming-stage-number">{stage.stage}</span>
                <span className="result2__streaming-stage-name">{stage.name}</span>
                
                {/* 🆕 미리보기 데이터 표시 */}
                {stage.preview && stage.preview.length > 0 && (
                  <div className="result2__streaming-preview">
                    {stage.preview.map((item, idx) => (
                      <span key={idx} className={`result2__preview-badge result2__preview-badge--${item.risk || 'info'}`}>
                        {item.icon} {item.name}
                      </span>
                    ))}
                  </div>
                )}
                
                <span className="result2__streaming-stage-icon">
                  {stage.status === 'complete' ? '✅' : 
                   stage.status === 'loading' ? '🔄' : '⏳'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🆕 하단 고정 진행 바 */}
      {isStreaming && (
        <div className="result2__bottom-progress">
          <div className="result2__bottom-progress-inner">
            <div className="result2__bottom-progress-bar">
              <div 
                className="result2__bottom-progress-fill" 
                style={{ width: `${streamProgress}%` }}
              />
            </div>
            <div className="result2__bottom-progress-info">
              <span className="result2__bottom-progress-stage">
                {currentStage ? `${currentStage}/7 단계` : '준비 중...'}
              </span>
              <span className="result2__bottom-progress-text">{streamingMessage}</span>
            </div>
          </div>
        </div>
      )}

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

      {/* 🆕 음식-약물 상호작용 맵 (약물상호작용 섹션 위로 이동) */}
      {detailedAnalysis?.medicalAnalysis?.drug_food_interactions && 
       detailedAnalysis.medicalAnalysis.drug_food_interactions.length > 0 && (
        <FoodDrugInteractionMatrix 
          interactions={detailedAnalysis.medicalAnalysis.drug_food_interactions}
          medicines={detailedAnalysis.medicalAnalysis.drug_food_interactions
            .flatMap(i => i.medicines || [])
            .filter((v, i, a) => a.indexOf(v) === i)}
          foodComponents={detailedAnalysis.medicalAnalysis.drug_food_interactions
            .flatMap(i => i.food_components || [])
            .filter((v, i, a) => a.indexOf(v) === i)}
        />
      )}

      {/* 약물 상호작용 - 위험/주의가 있을 때만 표시 (Accordion) */}
      {detailedAnalysis?.medicalAnalysis?.drug_food_interactions && 
       detailedAnalysis.medicalAnalysis.drug_food_interactions.some(d => d.risk_level === 'danger' || d.risk_level === 'caution') && (
        <div className="result2__accordion">
          <button 
            className={`result2__accordion-toggle result2__accordion-toggle--medicines`}
            onClick={() => toggleSection('medicines')}
          >
            <span className="result2__accordion-icon">⚠️</span>
            <span className="result2__accordion-title">복용 중인 약과의 상호작용</span>
            <span className={`result2__accordion-chevron ${expandedSections.medicines ? 'expanded' : ''}`}>
              ▼
            </span>
          </button>
          
          {expandedSections.medicines && (
            <div className="result2__accordion-content">
              <div className="result2__medicine-list">
                {detailedAnalysis.medicalAnalysis.drug_food_interactions
                  .filter(d => d.risk_level === 'danger' || d.risk_level === 'caution')
                  .map((drug, idx) => (
                    <div key={idx} className={`result2__medicine-card result2__medicine-card--${drug.risk_level}`}>
                      <div className="result2__medicine-header">
                        <span className="result2__medicine-name">{drug.medicine_name}</span>
                        <span className={`result2__risk-badge result2__risk-badge--${drug.risk_level}`}>
                          {drug.risk_level === 'danger' ? '위험' : '주의'}
                        </span>
                      </div>
                      {drug.interaction_description && (
                        <p className="result2__medicine-desc">{drug.interaction_description}</p>
                      )}
                      {drug.recommendation && (
                        <p className="result2__medicine-recommend">💡 {drug.recommendation}</p>
                      )}
                      
                      {/* 🆕 성분별 위험도 표시 */}
                      {drug.components && drug.components.length > 0 && (
                        <div className="result2__medicine-components">
                          <p className="result2__medicine-components-title">⚗️ 주요 성분별 위험도</p>
                          <MedicineComponentRiskCard
                            medicine={{ name: drug.medicine_name }}
                            components={drug.components}
                            interactions={detailedAnalysis.medicalAnalysis.drug_food_interactions}
                          />
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 주요 분석 내용 */}
      <div className="result2__main-content">
        {/* 🆕 시각적 분석 대시보드 (이런 점이 좋아요 위로 이동) */}
        {!isStreaming && detailedAnalysis && (
          <AnalysisDashboard detailedAnalysis={detailedAnalysis} />
        )}

        {/* 좋은 점 (Accordion) */}
        {detailedAnalysis?.goodPoints && Array.isArray(detailedAnalysis.goodPoints) && detailedAnalysis.goodPoints.length > 0 && (
          <div className="result2__accordion">
            <button 
              className={`result2__accordion-toggle result2__accordion-toggle--good`}
              onClick={() => toggleSection('goodPoints')}
            >
              <span className="result2__accordion-icon">✅</span>
              <span className="result2__accordion-title">이런 점이 좋아요</span>
              <span className={`result2__accordion-chevron ${expandedSections.goodPoints ? 'expanded' : ''}`}>
                ▼
              </span>
            </button>

            {expandedSections.goodPoints && (
              <div className="result2__accordion-content">
                <ul className="result2__analysis-list">
                  {detailedAnalysis.goodPoints.map((point, idx) => (
                    <li key={idx}>{point.replace(/^✅\s*/, '')}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 주의할 점 (Accordion) */}
        {detailedAnalysis?.badPoints && Array.isArray(detailedAnalysis.badPoints) && detailedAnalysis.badPoints.length > 0 && (
          <div className="result2__accordion">
            <button 
              className={`result2__accordion-toggle result2__accordion-toggle--bad`}
              onClick={() => toggleSection('badPoints')}
            >
              <span className="result2__accordion-icon">⚠️</span>
              <span className="result2__accordion-title">주의할 점이 있어요</span>
              <span className={`result2__accordion-chevron ${expandedSections.badPoints ? 'expanded' : ''}`}>
                ▼
              </span>
            </button>

            {expandedSections.badPoints && (
              <div className="result2__accordion-content">
                <ul className="result2__analysis-list">
                  {detailedAnalysis.badPoints.map((point, idx) => (
                    <li key={idx}>{point.replace(/^⚠️\s*/, '')}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 경고 사항 (Accordion) */}
        {detailedAnalysis?.warnings && Array.isArray(detailedAnalysis.warnings) && detailedAnalysis.warnings.length > 0 && (
          <div className="result2__accordion">
            <button 
              className={`result2__accordion-toggle result2__accordion-toggle--warning`}
              onClick={() => toggleSection('warnings')}
            >
              <span className="result2__accordion-icon">🚨</span>
              <span className="result2__accordion-title">특별 경고</span>
              <span className={`result2__accordion-chevron ${expandedSections.warnings ? 'expanded' : ''}`}>
                ▼
              </span>
            </button>

            {expandedSections.warnings && (
              <div className="result2__accordion-content">
                <ul className="result2__analysis-list">
                  {detailedAnalysis.warnings.map((warning, idx) => (
                    <li key={idx}>{warning.replace(/^🚨\s*/, '')}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 전문가 조언 제거 - summary와 중복되어 삭제 */}

        {/* 건강 조리법 (Accordion) */}
        {detailedAnalysis?.cookingTips && Array.isArray(detailedAnalysis.cookingTips) && detailedAnalysis.cookingTips.length > 0 && (
          <div className="result2__accordion">
            <button 
              className={`result2__accordion-toggle result2__accordion-toggle--tips`}
              onClick={() => toggleSection('cookingTips')}
            >
              <span className="result2__accordion-icon">👨‍🍳</span>
              <span className="result2__accordion-title">이렇게 먹으면 더 좋아요!</span>
              <span className={`result2__accordion-chevron ${expandedSections.cookingTips ? 'expanded' : ''}`}>
                ▼
              </span>
            </button>

            {expandedSections.cookingTips && (
              <div className="result2__accordion-content">
                <div className="result2__tips-list">
                  {detailedAnalysis.cookingTips.map((tipItem, idx) => {
                    const tipText = typeof tipItem === 'object' 
                      ? `${tipItem.category ? tipItem.category + ': ' : ''}${tipItem.tip || ''}`
                      : tipItem;
                    return (
                      <div key={idx} className="result2__tip-item">
                        <span className="result2__tip-number">{idx + 1}</span>
                        <span className="result2__tip-text">{tipText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 위험 성분 분석 (Accordion) */}
        {riskFactorEntries.length > 0 && (
          <>
            {/* 🆕 위험성분 시각화 (위험 성분 분석 섹션 위로 이동) */}
            <div className="result2__risk-visualization">
              <div className="result2__risk-chart-container">
                {riskFactorEntries.filter(entry => entry.active).map((entry) => (
                  <div key={entry.key} className="result2__risk-chart-item">
                    <div className="result2__risk-chart-label">
                      <span className="result2__risk-chart-icon">⚠️</span>
                      <span className="result2__risk-chart-name">{entry.label}</span>
                    </div>
                    <div className="result2__risk-chart-bar">
                      <div className="result2__risk-chart-fill" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                ))}
                {riskFactorEntries.filter(entry => entry.active).length === 0 && (
                  <div className="result2__risk-chart-empty">
                    <span className="result2__risk-chart-empty-icon">✅</span>
                    <span className="result2__risk-chart-empty-text">위험 성분이 검출되지 않았습니다</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="result2__accordion">
              <button 
                className={`result2__accordion-toggle result2__accordion-toggle--risk`}
                onClick={() => toggleSection('riskFactors')}
              >
                <span className="result2__accordion-icon">🔬</span>
                <span className="result2__accordion-title">위험 성분 분석</span>
                <span className={`result2__accordion-chevron ${expandedSections.riskFactors ? 'expanded' : ''}`}>
                  ▼
                </span>
              </button>

              {expandedSections.riskFactors && (
                <div className="result2__accordion-content">
                  <p className="result2__risk-subtitle">식품의약품안전처 데이터 기반</p>
                  <div className="result2__risk-list">
                    {riskFactorEntries.map((entry) => (
                      <div
                        key={entry.key}
                        className={`result2__risk-item ${entry.active ? 'result2__risk-item--active' : 'result2__risk-item--inactive'}`}
                      >
                        <div className="result2__risk-item-header">
                          <span className="result2__risk-item-name">{entry.label}</span>
                          <span className={`result2__risk-chip ${entry.active ? 'result2__risk-chip--active' : ''}`}>
                            {entry.active ? '검출' : '안전'}
                          </span>
                        </div>
                        <p className="result2__risk-item-note">{entry.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* 종합 분석 (Accordion) */}
        {(detailedAnalysis?.summary || analysis) && (
          <div className="result2__accordion">
            <button 
              className={`result2__accordion-toggle result2__accordion-toggle--summary`}
              onClick={() => toggleSection('summary')}
            >
              <span className="result2__accordion-icon">📋</span>
              <span className="result2__accordion-title">종합 분석</span>
              <span className={`result2__accordion-chevron ${expandedSections.summary ? 'expanded' : ''}`}>
                ▼
              </span>
            </button>

            {expandedSections.summary && (
              <div className="result2__accordion-content">
                <p className="result2__summary-content">
                  {(detailedAnalysis?.summary || analysis).replace(/^🔬\s*/, '')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 데이터 출처 */}
        <div className="result2__source-section">
          <p className="result2__source-label">데이터 출처</p>
          <p className="result2__source-value">{getDataSources()}</p>
        </div>

        {/* 추천 카드 */}
        <div className="result2__recommendations">
          <RecommendationCard 
            image={img_travel}
            title="하루하루 세계 민간요법"
            alt="하루하루 세계 민간요법"
          />
          <RecommendationCard 
            image={img_run}
            title="하루하루 추천 운동법"
            alt="하루하루 추천 운동법"
          />
        </div>

        {/* 면책 조항 */}
        <div className="result2__disclaimer">
          <p>본 앱은 의료 조언을 제공하지 않으며, 모든 건강 관련 결정은 반드시 전문의와 상의해야 합니다.</p>
          <p>본 앱의 정보는 참고용으로만 제공됩니다.</p>
        </div>
      </div>
    </div>
  );
};

export default Result2;
