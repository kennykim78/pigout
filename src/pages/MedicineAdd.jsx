import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicineStore } from '../store/medicineStore';
import { searchMedicine, searchHealthFood, addMedicine as addMedicineAPI, analyzeMedicineImage } from '../services/api';
import MedicineDetailPopup from '../components/MedicineDetailPopup';
import ImageSourceModal from '../components/ImageSourceModal';
import './Medicine.scss';

const MedicineAdd = () => {
  const navigate = useNavigate();
  const { medicines, setMedicines, setLoading, isLoading, setError } = useMedicineStore();
  
  // 탭 상태
  const [addSubTab, setAddSubTab] = useState('medicine'); // 'medicine' or 'healthfood'
  
  // 의약품 검색
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [tabSuggestion, setTabSuggestion] = useState(null);
  
  // 건강기능식품 검색
  const [healthFoodKeyword, setHealthFoodKeyword] = useState('');
  const [healthFoodResults, setHealthFoodResults] = useState([]);
  const [hasSearchedHealthFood, setHasSearchedHealthFood] = useState(false);
  const [healthFoodPage, setHealthFoodPage] = useState(1);
  const [healthFoodTabSuggestion, setHealthFoodTabSuggestion] = useState(null);
  
  // AI 이미지 분석
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalysisResult, setImageAnalysisResult] = useState(null);
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  const [showMedicineSelectPopup, setShowMedicineSelectPopup] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  
  // 상세 팝업
  const [selectedMedicineDetail, setSelectedMedicineDetail] = useState(null);
  const [showMedicineDetailPopup, setShowMedicineDetailPopup] = useState(false);
  
  // 약 추가 진행 상태
  const [isAdding, setIsAdding] = useState(false);
  const [addProgress, setAddProgress] = useState(null);

  // 이미지 압축 함수
  const compressImage = (file, maxSizeInBytes = 100 * 1024) => {
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
          
          const maxDimension = 1280;
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
          
          let quality = 0.9;
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (blob.size <= maxSizeInBytes || quality <= 0.3) {
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  console.log(`[이미지 압축] 완료: ${file.size} → ${compressedFile.size} bytes`);
                  resolve(compressedFile);
                } else {
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

  // 이미지 파일 선택
  const handleImageFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('[이미지 선택]', file.name, Math.round(file.size / 1024) + 'KB');

    let processedFile = file;
    try {
      processedFile = await compressImage(file, 100 * 1024);
    } catch (error) {
      console.error('[이미지 압축] 실패:', error);
      alert('이미지 압축에 실패했습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result.split(',')[1];
      const mimeType = processedFile.type || 'image/jpeg';
      
      setCapturedImage(reader.result);
      await analyzeImageWithAI(base64Data, mimeType);
    };
    reader.readAsDataURL(processedFile);
  };

  // AI 이미지 분석
  const analyzeImageWithAI = async (base64Data, mimeType) => {
    setIsAnalyzingImage(true);
    setImageAnalysisResult(null);
    
    try {
      const result = await analyzeMedicineImage(base64Data, mimeType);
      setImageAnalysisResult(result);
      
      if (result.success && result.verifiedMedicines?.length > 0) {
        setSelectedMedicines(result.verifiedMedicines.map(m => m.verified));
        setShowMedicineSelectPopup(true);
      }
    } catch (error) {
      console.error('[이미지 분석] 실패:', error);
      setImageAnalysisResult({
        success: false,
        message: error.response?.data?.message || '이미지 분석에 실패했습니다.',
        detectedMedicines: [],
        verifiedMedicines: [],
      });
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // 이미지 촬영 초기화
  const handleResetImageCapture = () => {
    setCapturedImage(null);
    setImageAnalysisResult(null);
    setSelectedMedicines([]);
    setShowMedicineSelectPopup(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // 약품 선택 토글
  const handleToggleMedicine = (index) => {
    setSelectedMedicines(prev => {
      const newSelection = [...prev];
      newSelection[index] = !newSelection[index];
      return newSelection;
    });
  };

  // 전체 선택/해제
  const handleSelectAllMedicines = (selectAll) => {
    if (!imageAnalysisResult?.verifiedMedicines) return;
    setSelectedMedicines(imageAnalysisResult.verifiedMedicines.map(() => selectAll));
  };

  // 이미지 인식 약품 상세정보 조회
  const fetchMedicineDetailForRegistration = async (itemSeq, itemName) => {
    if (!itemSeq && !itemName) return null;

    try {
      const keyword = itemSeq || itemName;
      const response = await searchMedicine(keyword, 1);
      const results = Array.isArray(response) ? response : (response?.results || []);
      
      if (results.length === 0) return null;

      if (itemSeq) {
        const exactMatch = results.find((item) => item.itemSeq === itemSeq);
        if (exactMatch) return exactMatch;
      }
      
      return results[0];
    } catch (error) {
      console.error('[상세정보 조회] 실패:', error);
      return null;
    }
  };

  // 선택한 약품 일괄 등록
  const handleAddSelectedMedicines = async () => {
    if (!imageAnalysisResult?.verifiedMedicines) return;
    
    const medicinesToAdd = imageAnalysisResult.verifiedMedicines.filter((_, idx) => selectedMedicines[idx]);
    
    if (medicinesToAdd.length === 0) {
      alert('등록할 약품을 선택해주세요.');
      return;
    }

    const TOTAL_MAX = 15;
    const currentCount = medicines.length;
    const remainingSlots = TOTAL_MAX - currentCount;
    
    if (remainingSlots <= 0) {
      alert(`최대 ${TOTAL_MAX}개까지만 등록 가능합니다.\n먼저 기존 약을 삭제한 후 등록해주세요.`);
      return;
    }
    
    if (medicinesToAdd.length > remainingSlots) {
      alert(`등록 가능한 슬롯이 ${remainingSlots}개 남았습니다.\n${remainingSlots}개만 등록 가능합니다.`);
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const medicine of medicinesToAdd) {
      try {
        const baseItemSeq = medicine.apiMatch?.itemSeq;
        const baseItemName = medicine.apiMatch?.itemName || medicine.detectedName;
        const baseEntpName = medicine.apiMatch?.entpName || medicine.manufacturer || '(정보 없음)';

        const detailData = await fetchMedicineDetailForRegistration(baseItemSeq, baseItemName);

        const medicineData = {
          itemName: detailData?.itemName || baseItemName,
          entpName: detailData?.entpName || baseEntpName,
          itemSeq: detailData?.itemSeq || baseItemSeq,
          efcyQesitm: detailData?.efcyQesitm,
          useMethodQesitm: detailData?.useMethodQesitm,
          atpnWarnQesitm: detailData?.atpnWarnQesitm,
          intrcQesitm: detailData?.intrcQesitm,
          seQesitm: detailData?.seQesitm,
          depositMethodQesitm: detailData?.depositMethodQesitm,
          isHealthFood: addSubTab === 'healthfood',
        };

        await addMedicineAPI(medicineData);
        successCount++;
      } catch (error) {
        console.error(`약 추가 실패 (${medicine.detectedName}):`, error);
        failCount++;
      }
    }

    setLoading(false);

    if (successCount > 0) {
      alert(`${successCount}개의 약이 등록되었습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ''}`);
      navigate('/medicine');
    } else {
      alert('약 등록에 실패했습니다.');
    }
  };

  // 의약품 검색
  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setCurrentPage(1);
    setTabSuggestion(null);
    
    try {
      const response = await searchMedicine(searchKeyword);
      
      if (response && response.suggestion) {
        setTabSuggestion(response.suggestion);
        setSearchResults([]);
      } else {
        const results = Array.isArray(response) ? response : (response.results || []);
        setSearchResults(results);
        
        if (results.length >= 200) {
          alert('검색결과가 200개 이상입니다.\n정확한 명칭이나, 제조사 등 세부적으로 검색바랍니다.');
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      setError('검색에 실패했습니다.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 건강기능식품 검색
  const handleHealthFoodSearch = async () => {
    if (!healthFoodKeyword.trim()) return;

    setLoading(true);
    setHasSearchedHealthFood(true);
    setHealthFoodPage(1);
    setHealthFoodTabSuggestion(null);
    
    try {
      const response = await searchHealthFood(healthFoodKeyword);
      
      if (response && response.suggestion) {
        setHealthFoodTabSuggestion(response.suggestion);
        setHealthFoodResults([]);
      } else {
        const results = Array.isArray(response) ? response : (response.results || []);
        setHealthFoodResults(results);
        
        if (results.length >= 200) {
          alert('검색결과가 200개 이상입니다.\n정확한 명칭이나, 제조사 등 세부적으로 검색바랍니다.');
        }
      }
    } catch (error) {
      console.error('Health food search failed:', error);
      setError('건강기능식품 검색에 실패했습니다.');
      setHealthFoodResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 탭 전환
  const handleTabSwitch = (targetTab, keyword) => {
    if (targetTab === 'healthfood') {
      setAddSubTab('healthfood');
      setHealthFoodKeyword(keyword);
      setTabSuggestion(null);
      setTimeout(() => handleHealthFoodSearch(), 100);
    } else {
      setAddSubTab('medicine');
      setSearchKeyword(keyword);
      setHealthFoodTabSuggestion(null);
      setTimeout(() => handleSearch(), 100);
    }
  };

  // 약 추가
  const handleAddMedicine = async (medicine) => {
    const steps = [
      { key: 'name', label: '약 이름 분석중', status: 'active' },
      { key: 'usage', label: '약 복용법 분석중', status: 'pending' },
      { key: 'public', label: '공공데이터 조회중', status: 'pending' },
      { key: 'register', label: '등록 중', status: 'pending' },
    ];

    const updateStep = (key, status) => {
      setAddProgress((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          steps: prev.steps.map((s) => (s.key === key ? { ...s, status } : s)),
        };
      });
    };

    try {
      setIsAdding(true);
      setAddProgress({
        isOpen: true,
        medicineName: medicine.itemName,
        steps,
        completed: false,
        success: false,
        error: null,
      });

      const isHealthFood = addSubTab === 'healthfood';
      const totalMedicines = medicines.length;
      const TOTAL_MAX = 15;
      
      if (totalMedicines >= TOTAL_MAX) {
        alert(`최대 ${TOTAL_MAX}개까지만 등록 가능합니다.`);
        setIsAdding(false);
        setAddProgress(null);
        return;
      }
      
      if (totalMedicines >= TOTAL_MAX - 2) {
        alert(`⚠️ 등록 가능한 약이 ${TOTAL_MAX - totalMedicines}개 남았습니다.`);
      }
      
      updateStep('name', 'done');
      updateStep('usage', 'active');
      updateStep('usage', 'done');
      updateStep('public', 'active');

      const result = await addMedicineAPI({
        itemName: medicine.itemName,
        entpName: medicine.entpName,
        itemSeq: medicine.itemSeq,
        efcyQesitm: medicine.efcyQesitm,
        isHealthFood: isHealthFood,
      });

      updateStep('public', 'done');
      updateStep('register', 'active');
      updateStep('register', 'done');
      setAddProgress((prev) => prev ? { ...prev, completed: true, success: true } : prev);
    } catch (error) {
      console.error('Add medicine failed:', error);
      updateStep('register', 'error');
      setAddProgress((prev) => prev ? { 
        ...prev, 
        completed: true, 
        success: false, 
        error: error.response?.data?.message || '약 추가에 실패했습니다.' 
      } : prev);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddProgressClose = () => {
    if (addProgress?.success) {
      navigate('/medicine');
    } else {
      setAddProgress(null);
      setIsAdding(false);
    }
  };

  return (
    <div className="medicine">
      {/* 헤더 */}
      <header className="medicine__header">
        <div className="medicine__header-content">
          <button 
            className="medicine__back-button"
            onClick={() => navigate('/medicine')}
          >
            ←
          </button>
          <h1>내약 추가</h1>
        </div>
      </header>

      {/* 탭 */}
      <div className="medicine__tabs medicine__tabs--add">
        <button
          className={`medicine__tab ${addSubTab === 'medicine' ? 'medicine__tab--active' : ''}`}
          onClick={() => setAddSubTab('medicine')}
        >
          💊 의약품
        </button>
        <button
          className={`medicine__tab ${addSubTab === 'healthfood' ? 'medicine__tab--active' : ''}`}
          onClick={() => setAddSubTab('healthfood')}
        >
          🥗 건강기능식품
        </button>
      </div>

      {/* 의약품 탭 */}
      {addSubTab === 'medicine' && (
        <div className="medicine__add">
          <section className="medicine__section">
            <h2 className="medicine__section-title">📸 약 촬영하기</h2>
            <p className="medicine__section-desc">
              약 봉지, 처방전, 알약 등을 촬영하면 AI가 자동으로 인식합니다
            </p>
            <div className="medicine__capture-buttons">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleImageFileSelect}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageFileSelect}
              />
              
              <button
                className="medicine__capture-btn medicine__capture-btn--primary"
                onClick={() => setShowImageSourceModal(true)}
                disabled={isAnalyzingImage}
              >
                📷 촬영하기
              </button>
            </div>

            {isAnalyzingImage && (
              <div className="medicine__analyzing">
                <div className="medicine__analyzing-spinner"></div>
                <p>🔍 AI가 약품을 분석하고 있습니다...</p>
              </div>
            )}

            {capturedImage && !isAnalyzingImage && (
              <div className="medicine__captured-preview">
                <img src={capturedImage} alt="촬영된 약" />
                <button
                  className="medicine__recapture-btn"
                  onClick={handleResetImageCapture}
                >
                  다시 촬영
                </button>
              </div>
            )}

            {imageAnalysisResult && !imageAnalysisResult.success && (
              <div className="medicine__analysis-error">
                <p>❌ {imageAnalysisResult.message}</p>
                <button
                  className="medicine__retry-btn"
                  onClick={handleResetImageCapture}
                >
                  다시 시도
                </button>
              </div>
            )}

            {showMedicineSelectPopup && imageAnalysisResult?.verifiedMedicines?.length > 0 && (
              <div className="medicine__select-popup-overlay">
                <div className="medicine__select-popup">
                  <div className="medicine__select-popup-header">
                    <h3>📋 인식된 약품 목록</h3>
                    <button
                      className="medicine__popup-close-btn"
                      onClick={() => {
                        setShowMedicineSelectPopup(false);
                        handleResetImageCapture();
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="medicine__select-popup-summary">
                    <p>
                      총 <strong>{imageAnalysisResult.summary.total}</strong>개 약품 감지 
                      (검증됨: {imageAnalysisResult.summary.verified}개)
                    </p>
                  </div>

                  <div className="medicine__select-actions">
                    <button
                      className="medicine__select-all-btn"
                      onClick={() => handleSelectAllMedicines(true)}
                    >
                      ✅ 전체 선택
                    </button>
                    <button
                      className="medicine__deselect-all-btn"
                      onClick={() => handleSelectAllMedicines(false)}
                    >
                      ⬜ 전체 해제
                    </button>
                  </div>

                  <div className="medicine__select-list">
                    {imageAnalysisResult.verifiedMedicines.map((medicine, index) => (
                      <div
                        key={index}
                        className={`medicine__select-item ${selectedMedicines[index] ? 'medicine__select-item--selected' : ''}`}
                        onClick={() => handleToggleMedicine(index)}
                      >
                        <div className="medicine__select-checkbox">
                          {selectedMedicines[index] ? '✅' : '⬜'}
                        </div>
                        <div className="medicine__select-info">
                          <div className="medicine__select-name">{medicine.detectedName}</div>
                          {medicine.apiMatch && (
                            <div className="medicine__select-meta">
                              제조사: {medicine.apiMatch.entpName}
                            </div>
                          )}
                          {medicine.verified && (
                            <div className="medicine__select-badge medicine__select-badge--verified">
                              ✅ 검증됨
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="medicine__select-actions">
                    <button
                      className="medicine__confirm-selection-btn"
                      onClick={handleAddSelectedMedicines}
                      disabled={!selectedMedicines.some(Boolean)}
                    >
                      선택한 약품 등록 ({selectedMedicines.filter(Boolean).length}개)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="medicine__section">
            <h2 className="medicine__section-title">🔍 약 검색하기</h2>
            <p className="medicine__section-desc">
              약 이름, 제조사, 성분명으로 검색하세요
            </p>
            
            <div className="medicine__search">
              <input
                type="text"
                className="medicine__search-input"
                placeholder="약 이름, 제조사, 성분명 입력"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                className="medicine__search-btn"
                onClick={handleSearch}
                disabled={isLoading}
              >
                검색
              </button>
            </div>

            <div style={{
              backgroundColor: medicines.length >= 15 ? '#FFEBEE' : '#E8F5E9',
              border: `2px solid ${medicines.length >= 15 ? '#EF5350' : '#66BB6A'}`,
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              marginTop: '12px',
            }}>
              <p style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 'bold',
                color: medicines.length >= 15 ? '#C62828' : '#2E7D32',
              }}>
                {medicines.length >= 15 
                  ? '🚨 최대 개수(15개)에 도달했습니다.'
                  : `📊 등록된 약: ${medicines.length}/15개 (남은 슬롯: ${15 - medicines.length}개)`
                }
              </p>
            </div>

            <div className="medicine__search-results">
              {tabSuggestion && (
                <div className="medicine__tab-suggestion">
                  <p>{tabSuggestion.message}</p>
                  <button onClick={() => handleTabSwitch(tabSuggestion.correctTab, searchKeyword)}>
                    🥗 건강기능식품 탭으로 이동
                  </button>
                </div>
              )}
              
              {searchResults.length > 0 ? (
                <>
                  <p className="medicine__results-count">전체 검색 결과: {searchResults.length}건</p>
                  {(() => {
                    const totalPages = Math.ceil(searchResults.length / itemsPerPage);
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const currentResults = searchResults.slice(startIndex, endIndex);
                    
                    return (
                      <>
                        {currentResults.map((result, index) => (
                          <div key={result.itemSeq || index} className="medicine__result-card">
                            <div className="medicine__result-header">
                              <h3 className="medicine__result-name">{result.itemName}</h3>
                              <span className="medicine__result-company">{result.entpName}</span>
                            </div>
                            <button
                              className="medicine__result-add-btn"
                              onClick={() => handleAddMedicine(result)}
                              disabled={isAdding}
                            >
                              추가
                            </button>
                          </div>
                        ))}
                        
                        {totalPages > 1 && (
                          <div className="medicine__pagination">
                            <button
                              className="medicine__page-btn"
                              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                              disabled={currentPage === 1}
                            >
                              이전
                            </button>
                            <div className="medicine__page-numbers">
                              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                                const page = Math.floor((currentPage - 1) / 10) * 10 + i + 1;
                                if (page > totalPages) return null;
                                return (
                                  <button
                                    key={page}
                                    className={`medicine__page-num ${currentPage === page ? 'medicine__page-num--active' : ''}`}
                                    onClick={() => setCurrentPage(page)}
                                  >
                                    {page}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              className="medicine__page-btn"
                              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                              disabled={currentPage === totalPages}
                            >
                              다음
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                hasSearched && !isLoading && (
                  <p className="medicine__no-results">
                    검색 결과가 없습니다.
                  </p>
                )
              )}
            </div>
          </section>
        </div>
      )}

      {/* 건강기능식품 탭 */}
      {addSubTab === 'healthfood' && (
        <div className="medicine__add">
          <section className="medicine__section">
            <h2 className="medicine__section-title">🥗 건강기능식품 검색</h2>
            <p className="medicine__section-desc">
              건강기능식품명, 원료명, 제조사로 검색하세요
            </p>
            
            <div className="medicine__search">
              <input
                type="text"
                className="medicine__search-input"
                placeholder="건강기능식품명, 원료명, 제조사 입력"
                value={healthFoodKeyword}
                onChange={(e) => setHealthFoodKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleHealthFoodSearch()}
              />
              <button
                className="medicine__search-btn"
                onClick={handleHealthFoodSearch}
                disabled={isLoading}
              >
                검색
              </button>
            </div>

            <div style={{
              backgroundColor: medicines.length >= 15 ? '#FFEBEE' : '#E8F5E9',
              border: `2px solid ${medicines.length >= 15 ? '#EF5350' : '#66BB6A'}`,
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              marginTop: '12px',
            }}>
              <p style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 'bold',
                color: medicines.length >= 15 ? '#C62828' : '#2E7D32',
              }}>
                {medicines.length >= 15 
                  ? '🚨 최대 개수(15개)에 도달했습니다.'
                  : `📊 등록된 약: ${medicines.length}/15개`
                }
              </p>
            </div>

            <div className="medicine__search-results">
              {healthFoodTabSuggestion && (
                <div className="medicine__tab-suggestion">
                  <p>{healthFoodTabSuggestion.message}</p>
                  <button onClick={() => handleTabSwitch('medicine', healthFoodKeyword)}>
                    💊 의약품 탭으로 이동
                  </button>
                </div>
              )}
              
              {healthFoodResults.length > 0 ? (
                <>
                  <p className="medicine__results-count">전체 검색 결과: {healthFoodResults.length}건</p>
                  {(() => {
                    const totalPages = Math.ceil(healthFoodResults.length / itemsPerPage);
                    const startIndex = (healthFoodPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const currentResults = healthFoodResults.slice(startIndex, endIndex);
                    
                    return (
                      <>
                        {currentResults.map((result, index) => (
                          <div key={result.itemSeq || index} className="medicine__result-card medicine__result-card--healthfood">
                            <div className="medicine__result-header">
                              <h3 className="medicine__result-name">{result.itemName}</h3>
                              <span className="medicine__result-company">{result.entpName}</span>
                            </div>
                            <button
                              className="medicine__result-add-btn"
                              onClick={() => handleAddMedicine(result)}
                              disabled={isAdding}
                            >
                              추가
                            </button>
                          </div>
                        ))}
                        
                        {totalPages > 1 && (
                          <div className="medicine__pagination">
                            <button
                              className="medicine__page-btn"
                              onClick={() => setHealthFoodPage(prev => Math.max(prev - 1, 1))}
                              disabled={healthFoodPage === 1}
                            >
                              이전
                            </button>
                            <div className="medicine__page-numbers">
                              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                                const page = Math.floor((healthFoodPage - 1) / 10) * 10 + i + 1;
                                if (page > totalPages) return null;
                                return (
                                  <button
                                    key={page}
                                    className={`medicine__page-num ${healthFoodPage === page ? 'medicine__page-num--active' : ''}`}
                                    onClick={() => setHealthFoodPage(page)}
                                  >
                                    {page}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              className="medicine__page-btn"
                              onClick={() => setHealthFoodPage(prev => Math.min(prev + 1, totalPages))}
                              disabled={healthFoodPage === totalPages}
                            >
                              다음
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                hasSearchedHealthFood && !isLoading && (
                  <p className="medicine__no-results">
                    검색 결과가 없습니다.
                  </p>
                )
              )}
            </div>
          </section>
        </div>
      )}

      {/* 약품 상세 정보 팝업 */}
      {showMedicineDetailPopup && (
        <MedicineDetailPopup
          medicine={selectedMedicineDetail}
          onClose={() => {
            setShowMedicineDetailPopup(false);
            setSelectedMedicineDetail(null);
          }}
        />
      )}

      {/* 이미지 소스 선택 모달 */}
      <ImageSourceModal
        isOpen={showImageSourceModal}
        onClose={() => setShowImageSourceModal(false)}
        onSelectCamera={() => {
          setShowImageSourceModal(false);
          cameraInputRef.current?.click();
        }}
        onSelectGallery={() => {
          setShowImageSourceModal(false);
          fileInputRef.current?.click();
        }}
      />

      {/* 약 추가 진행 오버레이 */}
      {addProgress?.isOpen && (
        <div className="medicine__add-overlay">
          <div className="medicine__add-modal">
            <h3 className="medicine__add-title">{addProgress.medicineName}을 추가 중입니다.</h3>
            <ul className="medicine__add-steps">
              {addProgress.steps.map((step) => (
                <li key={step.key} className={`medicine__add-step medicine__add-step--${step.status}`}>
                  <span className="medicine__add-step-dot" />
                  <span className="medicine__add-step-label">{step.label}</span>
                  <span className="medicine__add-step-status">
                    {step.status === 'active' && '진행중'}
                    {step.status === 'done' && '완료'}
                    {step.status === 'pending' && ''}
                    {step.status === 'error' && '오류'}
                  </span>
                </li>
              ))}
            </ul>

            {addProgress.completed && (
              <div className="medicine__add-complete">
                {addProgress.success ? (
                  <>
                    <p className="medicine__add-complete-text">등록이 완료되었습니다.</p>
                    <button className="medicine__add-complete-btn" onClick={handleAddProgressClose}>
                      목록으로
                    </button>
                  </>
                ) : (
                  <>
                    <p className="medicine__add-error-text">{addProgress.error}</p>
                    <button className="medicine__add-complete-btn" onClick={handleAddProgressClose}>
                      닫기
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicineAdd;
