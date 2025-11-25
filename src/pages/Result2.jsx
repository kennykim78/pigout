import './Result2.scss';
import imgangry from '../assets/images/img_angry.png';
import imghappy from '../assets/images/img_happy.png';
import imgcook from '../assets/images/img_cook.png';
import img_travel from '../assets/images/img_travel.png';
import img_run from '../assets/images/img_run.png';
import RecommendationCard from '../components/RecommendationCard';
import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

const imgsorce = 'https://img.bizthenaum.co.kr/data/img/1000000869/ori/1000000869_11.jpg';

const Result2 = () => {
  const location = useLocation();
  const [foodName, setFoodName] = useState('김치찌개');
  const [foodImage, setFoodImage] = useState(null);
  const [analysis, setAnalysis] = useState('');
  const [score, setScore] = useState(65);
  const [detailedAnalysis, setDetailedAnalysis] = useState(null);

  useEffect(() => {
    console.log('=== Result2 useEffect 실행 ===');
    console.log('location.state:', location.state);
    
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
      
      if (location.state.score !== undefined) {
        console.log('✅ score 설정:', location.state.score);
        setScore(location.state.score);
      }
      
      if (location.state.detailedAnalysis) {
        console.log('✅✅✅ detailedAnalysis 발견!');
        console.log('상세 분석 데이터:', location.state.detailedAnalysis);
        console.log('pros:', location.state.detailedAnalysis.pros);
        console.log('cons:', location.state.detailedAnalysis.cons);
        console.log('cookingTips:', location.state.detailedAnalysis.cookingTips);
        setDetailedAnalysis(location.state.detailedAnalysis);
        console.log('✅ setDetailedAnalysis 호출 완료');
      } else {
        console.error('❌❌❌ detailedAnalysis 없음!');
      }
      
      // cleanup 함수: blob URL 해제
      return () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      };
    } else {
      console.error('❌ location.state 자체가 없음!');
    }
  }, [location.state]);

  // 안좋은점 구성
  const getBadPoints = () => {
    console.log('🔴 getBadPoints 호출');
    console.log('  detailedAnalysis:', detailedAnalysis);
    
    const sections = [];
    
    // 1. AI가 분석한 음식과 질병의 안좋은점 (badPoints)
    if (detailedAnalysis?.badPoints && Array.isArray(detailedAnalysis.badPoints) && detailedAnalysis.badPoints.length > 0) {
      sections.push('【 음식과 질병의 안좋은 점 】');
      detailedAnalysis.badPoints.forEach((point, idx) => {
        sections.push(`${idx + 1}. ${point}`);
      });
      sections.push('');
    }
    
    // 2. 복용중인 약과의 상관관계 (음식 중심, 약 자체 설명 제외)
    if (detailedAnalysis?.medicalAnalysis?.drug_food_interactions) {
      const interactions = detailedAnalysis.medicalAnalysis.drug_food_interactions;
      const dangerDrugs = interactions.filter(d => d.risk_level === 'danger');
      const cautionDrugs = interactions.filter(d => d.risk_level === 'caution');
      
      if (dangerDrugs.length > 0 || cautionDrugs.length > 0) {
        sections.push('【 복용중인 약과의 상관관계 】');
        
        if (dangerDrugs.length > 0) {
          sections.push('🚨 위험 (절대 주의):');
          dangerDrugs.forEach((drug, idx) => {
            const components = drug.matched_components?.join(', ') || '';
            sections.push(`\n${idx + 1}. ${drug.medicine_name}${components ? ` [${components}]` : ''}`);
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
          sections.push('⚠️ 주의:');
          cautionDrugs.forEach((drug, idx) => {
            const components = drug.matched_components?.join(', ') || '';
            sections.push(`\n${idx + 1}. ${drug.medicine_name}${components ? ` [${components}]` : ''}`);
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
    }
    
    // 3. AI 분석과 약 상관관계 합한 총평
    if (detailedAnalysis?.summary) {
      sections.push('【 종합 평가 】');
      sections.push(detailedAnalysis.summary);
    }
    
    if (sections.length > 0) {
      return sections.join('\n');
    }
    
    return '특별히 주의할 점은 발견되지 않았습니다.';
  };

  // 좋은점 구성
  const getGoodPoints = () => {
    console.log('🟢 getGoodPoints 호출');
    console.log('  detailedAnalysis:', detailedAnalysis);
    
    const sections = [];
    
    // 1. AI가 분석한 음식과 질병의 좋은점 (goodPoints)
    if (detailedAnalysis?.goodPoints && Array.isArray(detailedAnalysis.goodPoints) && detailedAnalysis.goodPoints.length > 0) {
      sections.push('【 음식과 질병의 좋은 점 】');
      detailedAnalysis.goodPoints.forEach((point, idx) => {
        sections.push(`${idx + 1}. ${point}`);
      });
      sections.push('');
    }
    
    // 2. 복용중인 약과의 시너지 효과
    if (detailedAnalysis?.medicalAnalysis?.drug_food_interactions) {
      const safeDrugs = detailedAnalysis.medicalAnalysis.drug_food_interactions
        .filter(d => d.risk_level === 'safe' && d.interaction_description);
      
      if (safeDrugs.length > 0) {
        sections.push('【 복용중인 약과의 시너지 효과 】');
        safeDrugs.forEach((drug, idx) => {
          sections.push(`${idx + 1}. ${drug.medicine_name}`);
          if (drug.interaction_description) {
            sections.push(`   ${drug.interaction_description}`);
          }
        });
        sections.push('');
      }
    }
    
    // 3. 상위 두가지 합한 총평
    if (detailedAnalysis?.summary && score >= 70) {
      sections.push('【 종합 평가 】');
      sections.push(`이 음식은 전반적으로 건강에 도움이 되며, 복용중인 약과도 큰 문제가 없습니다. ${detailedAnalysis.summary}`);
    }
    
    if (sections.length > 0) {
      return sections.join('\n');
    }
    
    return '균형 잡힌 식단의 일부로 적당히 섭취하세요.';
  };

  const getCookingTips = () => {
    console.log('🔵 getCookingTips 호출');
    console.log('  detailedAnalysis:', detailedAnalysis);
    console.log('  detailedAnalysis?.cookingTips:', detailedAnalysis?.cookingTips);
    
    if (detailedAnalysis && detailedAnalysis.cookingTips && Array.isArray(detailedAnalysis.cookingTips) && detailedAnalysis.cookingTips.length > 0) {
      console.log('✅ cookingTips 배열 발견, 길이:', detailedAnalysis.cookingTips.length);
      return detailedAnalysis.cookingTips.map((tip, idx) => `${idx + 1}. ${tip}`).join('\n\n');
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
        <h1 className="result2__food-name">[ {foodName} ]</h1>
        {foodImage ? (
          <img src={foodImage} alt={foodName} className="result2__header-bg"/>
        ) : (
          <div className="result2__header-bg result2__header-bg--placeholder" style={{ backgroundColor: '#000' }}>
            <span style={{ color: '#fff', fontSize: '18px' }}>{foodName}</span>
          </div>
        )}
      </div>

      <div className="result2__sections">
        <div className="result2__section result2__section--bad">
          <div className="result2__section-header">
            <div className="result2__title-group">
              <h2 className="result2__section-title">
                좋지 않은<span className="result2__emoji">돼</span>~
              </h2>
              <img src={imgangry} alt="angry" className="result2__pig-icon" />
            </div>
          </div>
          <div className="result2__info-box">
            <p style={{ whiteSpace: 'pre-line' }}>
              {getBadPoints()}
            </p>
          </div>
        </div>

        <div className="result2__section result2__section--good">
          <div className="result2__section-header">
            <div className="result2__title-group">
              <h2 className="result2__section-title">
                이건 좋은<span className="result2__emoji">돼</span>~
              </h2>
              <img src={imghappy} alt="happy" className="result2__pig-icon" />
            </div>
          </div>
          <div className="result2__info-box">
            <p style={{ whiteSpace: 'pre-line' }}>
              {getGoodPoints()}
            </p>
          </div>
        </div>
      </div>

      <div className="result2__content">
        {riskFactorEntries.length > 0 && (
          <div className="result2__risk-section">
            <div className="result2__risk-header">
              <div>
                <p className="result2__risk-kicker">식품의약품안전처 분석 기반</p>
                <h3>위험 성분 & 근거</h3>
              </div>
            </div>
            <ul className="result2__risk-list">
              {riskFactorEntries.map((entry) => (
                <li
                  key={entry.key}
                  className={`result2__risk-item ${entry.active ? 'result2__risk-item--active' : 'result2__risk-item--inactive'}`}
                >
                  <div className="result2__risk-item-title">
                    <span>{entry.label}</span>
                    <span className={`result2__risk-chip ${entry.active ? 'result2__risk-chip--active' : ''}`}>
                      {entry.active ? '검출됨' : '가능성 낮음'}
                    </span>
                  </div>
                  <p>{entry.note}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summaryParagraphs.length > 0 && (
          <div className="result2__summary-section">
            <p className="result2__summary-kicker">AI 종합 리포트</p>
            {summaryParagraphs.map((paragraph, idx) => (
              <p key={`summary-${idx}`}>{paragraph}</p>
            ))}
          </div>
        )}

        <div className="result2__tips-section">
          <div className="result2__tips-header">
            <h2 className="result2__tips-title">
              이렇게<br />먹음돼지!
            </h2>
            <img src={imgcook} alt="cook" className="result2__pig-large" />
          </div>
          <div className="result2__tips-box">
            <p style={{ whiteSpace: 'pre-line' }}>
              {getCookingTips()}
            </p>
          </div>
        </div>

        <p className="result2__source">
          출처 : {getDataSources()}
        </p>

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

        <p className="result2__disclaimer">
          본 앱은 의료 조언을 제공하지 않으며, 모든 건강 관련 결정은 반드시 전문의와 상의해야 합니다. 본 앱의 정보는 참고용으로만 제공됩니다.
        </p>
      </div>
    </div>
  );
};

export default Result2;
