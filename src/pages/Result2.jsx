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

  // 분석 내용을 좋은점/나쁜점/조리법으로 분리
  const getBadPoints = () => {
    console.log('🔴 getBadPoints 호출');
    console.log('  detailedAnalysis:', detailedAnalysis);
    console.log('  detailedAnalysis?.cons:', detailedAnalysis?.cons);
    
    const badPoints = [];
    
    // 1. AI가 판단한 약물 상호작용 경고 (AI 분석 결과 사용)
    if (detailedAnalysis?.medicalAnalysis?.drug_food_interactions) {
      const interactions = detailedAnalysis.medicalAnalysis.drug_food_interactions;
      const dangerDrugs = interactions.filter(d => d.risk_level === 'danger');
      const cautionDrugs = interactions.filter(d => d.risk_level === 'caution');
      
      if (dangerDrugs.length > 0) {
        badPoints.push(`🚨 복용 중인 약물과의 위험한 상호작용:`);
        dangerDrugs.forEach((drug, idx) => {
          // AI가 분석한 매칭된 성분
          const matchedComponents = drug.matched_components || [];
          const componentInfo = matchedComponents.length > 0 ? ` [${matchedComponents.join(', ')}]` : '';
          
          badPoints.push(`\n${idx + 1}. ${drug.medicine_name}${componentInfo}`);
          if (drug.interaction_description) {
            badPoints.push(`   ⚠️ ${drug.interaction_description}`);
          }
          if (drug.evidence_from_public_data) {
            badPoints.push(`   📌 ${drug.evidence_from_public_data}`);
          }
          if (drug.recommendation) {
            badPoints.push(`   💡 ${drug.recommendation}`);
          }
        });
        badPoints.push('');
      }
      
      if (cautionDrugs.length > 0) {
        badPoints.push(`⚡ 복용 중인 약물 주의사항:`);
        cautionDrugs.forEach((drug, idx) => {
          const matchedComponents = drug.matched_components || [];
          const componentInfo = matchedComponents.length > 0 ? ` [${matchedComponents.join(', ')}]` : '';
          
          badPoints.push(`\n${idx + 1}. ${drug.medicine_name}${componentInfo}`);
          if (drug.interaction_description) {
            badPoints.push(`   → ${drug.interaction_description}`);
          }
          if (drug.recommendation) {
            badPoints.push(`   💡 ${drug.recommendation}`);
          }
        });
        badPoints.push('');
      }
    }
    
    // 2. AI가 분석한 일반 나쁜점 (finalAnalysis.badPoints)
    if (detailedAnalysis && detailedAnalysis.cons && Array.isArray(detailedAnalysis.cons) && detailedAnalysis.cons.length > 0) {
      console.log('✅ cons 배열 발견, 길이:', detailedAnalysis.cons.length);
      const consStart = badPoints.length > 0 ? badPoints.length : 0;
      detailedAnalysis.cons.forEach((con, idx) => {
        badPoints.push(`${consStart + idx + 1}. ${con}`);
      });
    }
    
    if (badPoints.length > 0) {
      return badPoints.join('\n');
    }
    
    console.log('⚠️ cons 배열 없음, 기본 텍스트 반환');
    if (score < 70) {
      return `${foodName}은(는) 주의가 필요한 음식입니다.\n\n${analysis}`;
    }
    return '특별히 주의할 점은 없습니다.';
  };

  const getGoodPoints = () => {
    console.log('🟢 getGoodPoints 호출');
    console.log('  detailedAnalysis:', detailedAnalysis);
    console.log('  detailedAnalysis?.pros:', detailedAnalysis?.pros);
    
    const goodPoints = [];
    
    // 1. 안전한 약물 상호작용 정보 (AI 분석 결과)
    if (detailedAnalysis?.medicalAnalysis?.drug_food_interactions) {
      const safeDrugs = detailedAnalysis.medicalAnalysis.drug_food_interactions
        .filter(d => d.risk_level === 'safe');
      
      if (safeDrugs.length > 0) {
        goodPoints.push('✅ 복용 중인 약물과 안전:');
        safeDrugs.forEach((drug, idx) => {
          const desc = drug.interaction_description || '특별한 상호작용 없음';
          goodPoints.push(`${idx + 1}. ${drug.medicine_name} - ${desc}`);
        });
        goodPoints.push('');
      }
    }
    
    // 2. AI가 분석한 일반 좋은점 (finalAnalysis.goodPoints)
    if (detailedAnalysis && detailedAnalysis.pros && Array.isArray(detailedAnalysis.pros) && detailedAnalysis.pros.length > 0) {
      console.log('✅ pros 배열 발견, 길이:', detailedAnalysis.pros.length);
      const prosStart = goodPoints.length > 0 ? goodPoints.length : 0;
      detailedAnalysis.pros.forEach((pro, idx) => {
        goodPoints.push(`${prosStart + idx + 1}. ${pro}`);
      });
    }
    
    if (goodPoints.length > 0) {
      return goodPoints.join('\n');
    }
    
    console.log('⚠️ pros 배열 없음, 기본 텍스트 반환');
    if (score >= 70) {
      return `${foodName}은(는) 건강에 좋은 선택입니다.\n\n${analysis}`;
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
          출처 : AI 분석 결과 / 식품의약품안전처 영양성분 DB
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
