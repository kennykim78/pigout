import './Main.scss';
import imgphoto from '../assets/images/img_photo.png';
import img_travel from '../assets/images/img_travel.png';
import img_run from '../assets/images/img_run.png';
import RecommendationCard from '../components/RecommendationCard';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { simpleAnalyzeFoodWithImage, simpleAnalyzeFoodByText, API_BASE_URL } from '../services/api';

const Main = () => {
  const fileInputRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('선택된 파일:', file);
      setIsLoading(true);
      
      try {
        // 이미지 크기 조정 (50KB 이하로)
        const compressedFile = await compressImage(file, 50 * 1024); // 50KB
        console.log('압축된 파일:', compressedFile);
        
        // 압축된 파일 저장
        setSelectedImage(compressedFile);
        
        // 이미지를 base64로 변환
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(compressedFile);
        });
        const base64Image = await base64Promise;
        
        console.log('AI로 음식명 추출 시작...');
        // AI로 음식명 추출 (간단한 분석)
        const response = await fetch(`${API_BASE_URL}/food/quick-analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64Image.split(',')[1] })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Quick analyze 응답:', data);
          if (data.success && data.foodName) {
            setVoiceText(data.foodName);
            console.log('AI가 추출한 음식명:', data.foodName);
          } else if (!data.success) {
            console.warn('이미지 유효성 검증 실패:', data.message);
            alert(data.message || '유효한 음식 이미지가 아닙니다.');
            setSelectedImage(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            return;
          }
        } else {
          console.error('Quick analyze API 오류:', response.status);
          // API 실패 시 기본 텍스트 사용
          setVoiceText('이 음식');
        }
      } catch (error) {
        console.error('음식명 추출 실패:', error);
        // 에러 시 기본 텍스트 사용
        setVoiceText('이 음식');
      } finally {
        setIsLoading(false);
      }
      
      // AI 분석 완료 후 미리보기 URL 생성 (팝업 표시)
      // compressedFile이 있으면 그것으로 URL 생성
      const compressedFile = await compressImage(file, 50 * 1024);
      const url = URL.createObjectURL(compressedFile);
      setPreviewUrl(url);
      console.log('미리보기 URL 설정 완료:', url);
    }
  };

  // 이미지 압축 함수
  const compressImage = (file, maxSizeInBytes) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // 최대 크기 설정 (너무 큰 이미지는 리사이즈)
          const maxDimension = 800;
          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // 품질을 조정하면서 목표 크기 이하로 압축
          let quality = 0.9;
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (blob.size <= maxSizeInBytes || quality <= 0.1) {
                  // 목표 크기 달성 또는 최소 품질에 도달
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  console.log(`압축 완료: ${file.size} -> ${compressedFile.size} bytes (quality: ${quality})`);
                  resolve(compressedFile);
                } else {
                  // 품질을 낮춰서 다시 시도
                  quality -= 0.1;
                  tryCompress();
                }
              },
              'image/jpeg',
              quality
            );
          };
          
          tryCompress();
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleVoiceClick = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('음성 인식이 지원되지 않는 브라우저입니다.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      console.log('음성 인식 시작');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('인식된 텍스트:', transcript);
      setVoiceText(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('음성 인식 오류:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        alert('음성이 감지되지 않았습니다.');
      } else if (event.error === 'not-allowed') {
        alert('마이크 권한이 필요합니다.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log('음성 인식 종료');
    };

    recognition.start();
  };

  const handleSaveClick = async () => {
    if (!voiceText.trim() && !selectedImage) {
      alert('음식 이름을 입력하거나 사진을 선택해주세요.');
      return;
    }

    // 저장된 질병 정보 확인
    const savedDiseases = localStorage.getItem('selectedDiseases');
    console.log('저장된 질병 정보:', savedDiseases);

    setIsLoading(true);
    try {
      let result;
      
      // 빠른 AI 분석 사용 (공공데이터 없이 순수 AI 지식으로 분석)
      if (selectedImage && voiceText.trim()) {
        // 이미지와 텍스트 모두 있는 경우
        console.log('🚀 빠른 AI 분석 (이미지+텍스트):', voiceText);
        result = await simpleAnalyzeFoodWithImage(voiceText.trim(), selectedImage);
      } else if (selectedImage) {
        // 이미지만 있는 경우 - AI가 이미지에서 제품명 추출
        console.log('🚀 빠른 AI 분석 (이미지만)');
        result = await simpleAnalyzeFoodWithImage('', selectedImage);
      } else {
        // 텍스트만 있는 경우
        console.log('🚀 빠른 AI 분석 (텍스트만):', voiceText);
        result = await simpleAnalyzeFoodByText(voiceText.trim());
      }

      console.log('분석 결과:', result);
      console.log('result.data:', result.data);
      console.log('result.data?.foodName:', result.data?.foodName);
      console.log('result.data?.score:', result.data?.score);
      console.log('result.data?.analysis:', result.data?.analysis);
      console.log('result.data?.detailedAnalysis:', result.data?.detailedAnalysis);
      
      if (result.data?.detailedAnalysis) {
        console.log('✅ detailedAnalysis 존재!');
        console.log('  - pros:', result.data.detailedAnalysis.pros);
        console.log('  - cons:', result.data.detailedAnalysis.cons);
        console.log('  - cookingTips:', result.data.detailedAnalysis.cookingTips);
      } else {
        console.error('❌ detailedAnalysis 없음!');
      }

      // 분석 결과와 함께 Result01로 이동
      const navigationData = { 
        foodName: result.data?.foodName || result.foodName,
        foodImage: selectedImage,
        imageUrl: result.data?.imageUrl || result.imageUrl,
        score: result.data?.score || result.score,
        analysis: result.data?.analysis || result.analysis,
        detailedAnalysis: result.data?.detailedAnalysis || result.detailedAnalysis,
        analysisId: result.data?.id || result.id,
        category: result.data?.category || result.category // 카테고리 추가
      };
      
      console.log('Result01로 전달할 데이터:', navigationData);
      console.log('전달 데이터 확인 - foodName:', navigationData.foodName);
      console.log('전달 데이터 확인 - score:', navigationData.score);
      console.log('전달 데이터 확인 - analysis:', navigationData.analysis);
      console.log('전달 데이터 확인 - detailedAnalysis:', navigationData.detailedAnalysis);
      
      if (navigationData.detailedAnalysis) {
        console.log('✅ navigationData에 detailedAnalysis 포함됨');
        console.log('  - pros 개수:', navigationData.detailedAnalysis.pros?.length);
        console.log('  - cons 개수:', navigationData.detailedAnalysis.cons?.length);
      } else {
        console.error('❌ navigationData에 detailedAnalysis 없음!');
      }
      
      if (!navigationData.foodName || !navigationData.score) {
        console.error('❌ 경고: navigate할 데이터가 불완전합니다!');
        console.error('navigationData:', navigationData);
        alert('분석 데이터가 완전하지 않습니다. 다시 시도해주세요.');
        return;
      }
      
      navigate('/result01', { state: navigationData });
    } catch (error) {
      console.error('음식 분석 중 오류:', error);
      console.error('에러 상세:', error.response?.data || error.message);
      
      // 백엔드에서 반환한 에러 메시지 확인
      const errorMessage = error.response?.data?.message 
        || error.message 
        || '음식 분석 중 오류가 발생했습니다.';
      
      if (error.code === 'ERR_NETWORK') {
        alert('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.\n(http://localhost:3001)');
      } else if (error.response?.status === 400 && errorMessage.includes('음식이나')) {
        // 이미지 유효성 검증 실패
        alert(errorMessage);
        // 이미지 초기화
        setSelectedImage(null);
        setPreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        alert(`분석 오류: ${errorMessage}\n\n다시 시도해주세요.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="main">
      <div className="main__content">
        <h1 className="main__title">
          먹고 싶은 음식을<br />지금! 촬영하거나 입력해주셔유~
        </h1>

        <div className="main__action-section">
          <div className="main__camera-circle">
            <div className="main__camera-outer">
              <div className="main__camera-inner">
                <img src={imgphoto} alt="Pig" className="main__pig-image" />
                <button className="main__camera-button" onClick={handleCameraClick}>
                  <span className="material-symbols-rounded">
                    photo_camera
                  </span>
                  <span>촬영</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>

          <p className="main__divider">또는</p>

          <button className="main__voice-button" onClick={handleVoiceClick}>
            <span className="material-symbols-rounded">
              {isListening ? 'mic' : 'mic'}
            </span>
            <span>{isListening ? '듣는 중...' : '말하기'}</span>
          </button>

          <div className="main__input-wrapper">
            <input
              type="text"
              className="main__input"
              placeholder="직접입력"
              value={voiceText}
              onChange={(e) => setVoiceText(e.target.value)}
            />
            <button 
              className="main__save-button"
              disabled={!voiceText.trim() && !selectedImage}
              onClick={handleSaveClick}
            >
              저장
            </button>
          </div>

          {/* 음식 이름 표시 */}
          {voiceText && (
            <div className="main__food-name-display">
              <p>음식: <strong>{voiceText}</strong></p>
            </div>
          )}

        </div>

        {/* 전체 화면 로딩 레이어 팝업 */}
        {isLoading && (
          <div className="main__loading-overlay">
            <div className="main__loading-modal">
              <div className="main__loading-content">
                <div className="main__loading-pig-animation">
                  <img src={imgphoto} alt="Loading" className="main__loading-pig" />
                  <div className="main__loading-spinner"></div>
                </div>
                
                <div className="main__loading-text">
                  <h2>먹어도돼지가 열심히 분석 중입니다!</h2>
                  <div className="main__loading-steps">
                    <p className="main__loading-step">� 입력한 음식 확인 중...</p>
                    <p className="main__loading-step">📊 영양 성분 분석 중...</p>
                    <p className="main__loading-step">📚 건강 자료 조사 중...</p>
                  </div>
                </div>

                {/* 광고 배치 영역 */}
                <div className="main__ad-container">
                  <div className="main__ad-placeholder">
                    <p className="main__ad-label">광고 영역</p>
                    <p className="main__ad-desc">앱 버전에서 광고가 표시됩니다</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 이미지 미리보기 풀 레이어 팝업 - 로딩 중이 아닐 때만 표시 */}
        {previewUrl && !isLoading && (
          <div className="main__preview-overlay">
            <div className="main__preview-modal">
              <button 
                className="main__preview-close"
                onClick={() => {
                  setSelectedImage(null);
                  setPreviewUrl(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                <span className="material-symbols-rounded">close</span>
              </button>
              
              <div className="main__preview-content">
                <img src={previewUrl} alt="선택한 음식" className="main__preview-image" />
                
                <div className="main__preview-question">
                  <p>선택하신 이미지가</p>
                  <p className="main__preview-food-name">[{voiceText || '이 음식'}]</p>
                  <p>이 맞습니까?</p>
                </div>

                <div className="main__preview-buttons">
                  <button 
                    className="main__preview-button main__preview-button--no"
                    onClick={() => {
                      setSelectedImage(null);
                      setPreviewUrl(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    아니오
                  </button>
                  <button 
                    className="main__preview-button main__preview-button--yes"
                    onClick={handleSaveClick}
                  >
                    예
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="main__recommendations">
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

export default Main;
