import './Result01.scss';
import imgworry from '../assets/images/img_worry.png';
import img_travel from '../assets/images/img_travel.png';
import img_run from '../assets/images/img_run.png';
import RecommendationCard from '../components/RecommendationCard';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

const imgsorce = 'https://img.bizthenaum.co.kr/data/img/1000000869/ori/1000000869_11.jpg';

const Result01 = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [foodName, setFoodName] = useState('');
  const [foodImage, setFoodImage] = useState(null);
  const [score, setScore] = useState(0);
  const [analysis, setAnalysis] = useState('');
  const [analysisId, setAnalysisId] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [detailedAnalysis, setDetailedAnalysis] = useState(null);

  useEffect(() => {
    console.log('Result01 - location.state:', location.state);
    
    if (location.state) {
      // 음식 이름
      if (location.state.foodName) {
        console.log('음식명 설정:', location.state.foodName);
        setFoodName(location.state.foodName);
      }
      
      // 업로드한 이미지 (File 객체)
      if (location.state.foodImage) {
        const imageUrl = URL.createObjectURL(location.state.foodImage);
        setFoodImage(imageUrl);
      } else if (location.state.imageUrl) {
        // 서버에서 저장된 이미지 URL
        setFoodImage(location.state.imageUrl);
      }
      
      // AI 분석 점수
      if (location.state.score !== undefined) {
        console.log('점수 설정:', location.state.score);
        setScore(location.state.score);
      }
      
      // AI 분석 내용
      if (location.state.analysis) {
        console.log('분석 내용 설정:', location.state.analysis);
        setAnalysis(location.state.analysis);
      }
      
      // 분석 ID (상세보기용)
      if (location.state.analysisId) {
        setAnalysisId(location.state.analysisId);
      }
      
      // 상세 분석 데이터
      if (location.state.detailedAnalysis) {
        console.log('상세 분석 설정:', location.state.detailedAnalysis);
        setDetailedAnalysis(location.state.detailedAnalysis);
      }
    } else {
      console.warn('Result01 - location.state가 없습니다!');
    }
    
    // cleanup function: 컴포넌트 언마운트 시 URL 해제
    return () => {
      if (location.state?.foodImage && foodImage) {
        URL.revokeObjectURL(foodImage);
      }
    };
  }, [location.state]);

  const getScoreComment = (score) => {
    if (score >= 85) return '아주\n좋아요!';
    if (score >= 70) return '나쁘지는\n않은데 말입죠\n...';
    if (score >= 50) return '조금\n주의가\n필요해요';
    return '피하시는게\n좋겠어요';
  };

  const handleDetailClick = () => {
    console.log('=== 자세히보기 버튼 클릭 ===');
    console.log('detailedAnalysis state:', detailedAnalysis);
    console.log('location.state.detailedAnalysis:', location.state?.detailedAnalysis);
    console.log('전달할 데이터:', {
      foodName,
      foodImage: location.state?.foodImage,
      imageUrl: foodImage,
      score,
      analysis,
      detailedAnalysis: location.state?.detailedAnalysis || detailedAnalysis,
      analysisId,
    });
    
    navigate('/result2', {
      state: {
        foodName,
        foodImage: location.state?.foodImage,
        imageUrl: foodImage,
        score,
        analysis,
        detailedAnalysis: location.state?.detailedAnalysis || detailedAnalysis,
        analysisId,
      },
    });
  };

  // 데이터가 없으면 로딩 또는 안내 표시
  if (!foodName && !score) {
    return (
      <div className="result01">
        <div className="result01__content">
          <div style={{ padding: '50px', textAlign: 'center' }}>
            <p>분석 결과를 불러오는 중...</p>
            <p style={{ marginTop: '20px', color: '#666' }}>
              데이터가 없다면 메인 페이지에서 음식을 분석해주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="result01">
      <div className="result01__header">
        <h1 className="result01__food-name">[ {foodName || '음식'} ]</h1>
        <p className="result01__question">드시고 싶은가유?</p>
        {foodImage ? (
          <img src={foodImage} alt={foodName} className="result01__header-bg"/>
        ) : (
          <div className="result01__header-bg result01__header-bg--placeholder" style={{ backgroundColor: '#000' }}>
            <span style={{ color: '#fff', fontSize: '18px' }}>{foodName || '음식'}</span>
          </div>
        )}
      </div>

      <div className="result01__content">
        <div className="result01__score-section">
          <div className="result01__score-outer">
            <div className="result01__score-inner">
              <div className="result01__score-content">
                <p className="result01__score-label">적합점수</p>
                <p className="result01__score-value">{score}</p>
                <p className="result01__score-comment">
                  {getScoreComment(score)}
                </p>
              </div>
            </div>
          </div>
            
        </div>
        <div className="result01__info-section">
          <img src={imgworry} alt={foodName} className="result01__food-image"/>
          <div className="result01__info-card">
            {/* AI 200자 요약: 음식 분석 + 내 약과의 상관관계 */}
            <p style={{ whiteSpace: 'pre-line', fontSize: '15px', lineHeight: '1.6' }}>
              {detailedAnalysis?.briefSummary || analysis || '분석 결과를 불러오는 중입니다...'}
            </p>
          </div>
          <button className="result01__detail-button" onClick={handleDetailClick}>
            자세히 보기
          </button>
        </div>

        <div className="result01__recommendations">
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
      </div>
    </div>
  );
};

export default Result01;
