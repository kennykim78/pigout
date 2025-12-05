import { useState, useEffect, useRef } from 'react';
import { useMedicineStore } from '../store/medicineStore';
import { getMyMedicines, scanMedicineQR, searchMedicine, searchHealthFood, deleteMedicine, addMedicine as addMedicineAPI, analyzeAllMedicines, analyzeMedicineImage } from '../services/api';
import MedicineRadarChart from '../components/MedicineRadarChart';
import MedicineSchedule from '../components/MedicineSchedule';
import MedicineCorrelationSummary from '../components/MedicineCorrelationSummary';
import MedicineDetailPopup from '../components/MedicineDetailPopup';
import './Medicine.scss';

const Medicine = () => {
  const { medicines, setMedicines, addMedicine: addToStore, deleteMedicine: removeFromStore, isLoading, setLoading, setError } = useMedicineStore();
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [scanMode, setScanMode] = useState('manual'); // 'camera' or 'manual'
  const [qrInput, setQrInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [addSubTab, setAddSubTab] = useState('medicine'); // 'medicine' or 'healthfood'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // 건강기능식품 탭용 상태
  const [healthFoodKeyword, setHealthFoodKeyword] = useState('');
  const [healthFoodResults, setHealthFoodResults] = useState([]);
  const [hasSearchedHealthFood, setHasSearchedHealthFood] = useState(false);
  const [healthFoodPage, setHealthFoodPage] = useState(1);
  
  // 탭 이동 안내 상태
  const [tabSuggestion, setTabSuggestion] = useState(null);
  const [healthFoodTabSuggestion, setHealthFoodTabSuggestion] = useState(null);
  
  // QR 스캔 결과 상태
  const [scannedMedicine, setScannedMedicine] = useState(null);
  const [isProcessingQR, setIsProcessingQR] = useState(false);
  const [qrScanError, setQrScanError] = useState('');
  
  // 📸 AI 이미지 분석 상태
  const [showImageCapture, setShowImageCapture] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalysisResult, setImageAnalysisResult] = useState(null);
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  const [showMedicineSelectPopup, setShowMedicineSelectPopup] = useState(false);
  const [selectedMedicineDetail, setSelectedMedicineDetail] = useState(null);
  const [showMedicineDetailPopup, setShowMedicineDetailPopup] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    setLoading(true);
    try {
      const data = await getMyMedicines(true);
      console.log('[Medicine.jsx] Loaded medicines:', data);
      console.log('[Medicine.jsx] Medicine keys:', data?.[0] ? Object.keys(data[0]) : 'No data');
      setMedicines(data);
    } catch (error) {
      console.error('Failed to load medicines:', error);
      setError('약 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleQrScan = async (qrData) => {
    const data = qrData || qrInput;
    if (!data.trim()) {
      alert('QR 데이터를 입력하세요.');
      return;
    }

    setLoading(true);
    try {
      const result = await scanMedicineQR(data);
      addToStore(result.medicineRecord);
      setQrInput('');
      setShowQrScanner(false);
      setScanMode('manual');
      setScannedMedicine(null);
      alert(`${result.parsedInfo.medicineName} 추가 완료!`);
      await loadMedicines();
    } catch (error) {
      console.error('QR scan failed:', error);
      alert(error.response?.data?.message || 'QR 스캔에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 카메라로 QR 인식 시 호출
  const handleCameraScan = async (result) => {
    if (result && result[0]?.rawValue && !isProcessingQR) {
      const qrData = result[0].rawValue;
      console.log('[QR 인식됨]', qrData);
      
      setIsProcessingQR(true);
      setQrScanError('');
      
      try {
        // QR 데이터로 약 정보 조회
        const scanResult = await scanMedicineQR(qrData);
        console.log('[QR 스캔 결과]', scanResult);
        
        // 스캔된 약 정보 저장 (등록 확인용)
        setScannedMedicine({
          qrData,
          parsedInfo: scanResult.parsedInfo,
          medicineRecord: scanResult.medicineRecord
        });
      } catch (error) {
        console.error('QR 처리 실패:', error);
        setQrScanError(error.response?.data?.message || 'QR 코드를 인식할 수 없습니다. 다시 시도해주세요.');
        setIsProcessingQR(false);
      }
    }
  };

  // QR 스캔 결과에서 약 등록
  const handleAddScannedMedicine = async () => {
    if (!scannedMedicine) return;
    
    setLoading(true);
    try {
      addToStore(scannedMedicine.medicineRecord);
      alert(`${scannedMedicine.parsedInfo.medicineName} 추가 완료!`);
      await loadMedicines();
      
      // 초기화
      setScannedMedicine(null);
      setShowQrScanner(false);
      setScanMode('manual');
      setIsProcessingQR(false);
      setActiveTab('list');
    } catch (error) {
      console.error('약 추가 실패:', error);
      alert('약 추가에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // QR 스캐너 닫기
  const handleCloseQrScanner = () => {
    setShowQrScanner(false);
    setScanMode('manual');
    setScannedMedicine(null);
    setIsProcessingQR(false);
    setQrScanError('');
  };

  // 다시 스캔하기
  const handleRescan = () => {
    setScannedMedicine(null);
    setIsProcessingQR(false);
    setQrScanError('');
  };

  // 📸 이미지 파일 선택 핸들러
  const handleImageFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일을 Base64로 변환
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result.split(',')[1]; // data:image/... 부분 제거
      const mimeType = file.type || 'image/jpeg';
      
      setCapturedImage(reader.result);
      await analyzeImageWithAI(base64Data, mimeType);
    };
    reader.readAsDataURL(file);
  };

  // 📸 AI로 이미지 분석
  const analyzeImageWithAI = async (base64Data, mimeType) => {
    setIsAnalyzingImage(true);
    setImageAnalysisResult(null);
    
    try {
      console.log('[이미지 분석] 시작');
      const result = await analyzeMedicineImage(base64Data, mimeType);
      console.log('[이미지 분석] 결과:', result);
      
      setImageAnalysisResult(result);
      
      if (result.success && result.verifiedMedicines?.length > 0) {
        // 감지된 약품이 있으면 선택 팝업 표시
        setSelectedMedicines(result.verifiedMedicines.map(m => m.verified)); // 검증된 약품만 기본 선택
        setShowMedicineSelectPopup(true);
      }
    } catch (error) {
      console.error('[이미지 분석] 실패:', error);
      setImageAnalysisResult({
        success: false,
        message: '이미지 분석에 실패했습니다. 다시 시도해주세요.',
        detectedMedicines: [],
        verifiedMedicines: [],
      });
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // 📸 이미지 촬영/업로드 초기화
  const handleResetImageCapture = () => {
    setCapturedImage(null);
    setImageAnalysisResult(null);
    setSelectedMedicines([]);
    setShowMedicineSelectPopup(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // 📸 약품 선택 토글
  const handleToggleMedicine = (index) => {
    setSelectedMedicines(prev => {
      const newSelection = [...prev];
      newSelection[index] = !newSelection[index];
      return newSelection;
    });
  };

  // 📸 전체 선택/해제
  const handleSelectAllMedicines = (selectAll) => {
    if (!imageAnalysisResult?.verifiedMedicines) return;
    setSelectedMedicines(imageAnalysisResult.verifiedMedicines.map(() => selectAll));
  };

  // 📸 선택한 약품들 일괄 등록
  const handleAddSelectedMedicines = async () => {
    if (!imageAnalysisResult?.verifiedMedicines) return;
    
    const medicinesToAdd = imageAnalysisResult.verifiedMedicines.filter((_, idx) => selectedMedicines[idx]);
    
    if (medicinesToAdd.length === 0) {
      alert('등록할 약품을 선택해주세요.');
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const medicine of medicinesToAdd) {
      try {
        const medicineData = medicine.apiMatch ? {
          itemName: medicine.apiMatch.itemName,
          entpName: medicine.apiMatch.entpName,
          itemSeq: medicine.apiMatch.itemSeq,
          efcyQesitm: medicine.apiMatch.efcyQesitm,
        } : {
          itemName: medicine.detectedName,
          entpName: medicine.manufacturer || '(정보 없음)',
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
      await loadMedicines();
      handleResetImageCapture();
      setShowImageCapture(false);
      setActiveTab('list');
    } else {
      alert('약 등록에 실패했습니다.');
    }
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setCurrentPage(1);
    setTabSuggestion(null); // 이전 안내 초기화
    try {
      console.log('[검색 시작] 키워드:', searchKeyword);
      // 🆕 제한 없이 모든 결과 조회 (백엔드에서 최대값 제한)
      const response = await searchMedicine(searchKeyword);
      console.log('[검색 완료] 결과:', response);
      
      // 탭 이동 안내가 있는 경우
      if (response && response.suggestion) {
        console.log('[검색 완료] 탭 이동 안내:', response.suggestion);
        setTabSuggestion(response.suggestion);
        setSearchResults([]);
      } else {
        // 일반 검색 결과
        const results = Array.isArray(response) ? response : (response.results || []);
        setSearchResults(results);
        
        // 100개 이상 결과 알럿
        if (results.length >= 100) {
          alert('검색결과가 100개 이상입니다.\n정확한 명칭이나, 제조사 등 세부적으로 검색바랍니다.');
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      console.error('Error details:', error.response?.data);
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
    setHealthFoodTabSuggestion(null); // 이전 안내 초기화
    try {
      console.log('[건강기능식품 검색 시작] 키워드:', healthFoodKeyword);
      // 🆕 제한 없이 모든 결과 조회 (백엔드에서 최대값 제한)
      const response = await searchHealthFood(healthFoodKeyword);
      console.log('[건강기능식품 검색 완료] 결과:', response);
      
      // 탭 이동 안내가 있는 경우
      if (response && response.suggestion) {
        console.log('[건강기능식품 검색 완료] 탭 이동 안내:', response.suggestion);
        setHealthFoodTabSuggestion(response.suggestion);
        setHealthFoodResults([]);
      } else {
        // 일반 검색 결과
        const results = Array.isArray(response) ? response : (response.results || []);
        setHealthFoodResults(results);
        
        // 100개 이상 결과 알럿
        if (results.length >= 100) {
          alert('검색결과가 100개 이상입니다.\n정확한 명칭이나, 제조사 등 세부적으로 검색바랍니다.');
        }
      }
    } catch (error) {
      console.error('Health food search failed:', error);
      console.error('Error details:', error.response?.data);
      setError('건강기능식품 검색에 실패했습니다.');
      setHealthFoodResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 탭 이동 핸들러
  const handleTabSwitch = (targetTab, keyword) => {
    setActiveTab('add');
    if (targetTab === 'healthfood') {
      setAddSubTab('healthfood');
      setHealthFoodKeyword(keyword);
      setTabSuggestion(null);
      // 자동 검색
      setTimeout(() => {
        document.querySelector('.medicine__search-btn')?.click();
      }, 100);
    } else if (targetTab === 'add' || targetTab === 'medicine') {
      setAddSubTab('medicine');
      setSearchKeyword(keyword);
      setHealthFoodTabSuggestion(null);
      // 자동 검색
      setTimeout(() => {
        document.querySelector('.medicine__search-btn')?.click();
      }, 100);
    }
  };

  const handleAddMedicine = async (medicine) => {
    try {
      setLoading(true);
      const result = await addMedicineAPI({
        itemName: medicine.itemName,
        entpName: medicine.entpName,
        itemSeq: medicine.itemSeq,
        efcyQesitm: medicine.efcyQesitm,
      });
      
      console.log('약 추가 성공:', result);
      alert(`${medicine.itemName} 추가 완료!`);
      
      // 목록 새로고침
      await loadMedicines();
      
      // 검색 결과 초기화
      setSearchResults([]);
      setSearchKeyword('');
      setActiveTab('list');
    } catch (error) {
      console.error('Add medicine failed:', error);
      alert(error.response?.data?.message || '약 추가에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedicine = async (id) => {
    if (!confirm('이 약을 삭제하시겠습니까?')) return;

    try {
      await deleteMedicine(id);
      removeFromStore(id);
      alert('삭제되었습니다.');
      
      // 삭제 후 분석 결과 초기화
      if (analysisResult) {
        setAnalysisResult(null);
        setShowAnalysis(false);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const handleAnalyzeAll = async () => {
    if (medicines.length === 0) {
      alert('복용 중인 약이 없습니다. 먼저 약을 추가해주세요.');
      return;
    }

    setIsAnalyzing(true);
    try {
      console.log('[약물 상관관계 분석] 시작...');
      const result = await analyzeAllMedicines();
      console.log('[약물 상관관계 분석] 완료:', result);
      setAnalysisResult(result);
      setShowAnalysis(true);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert(error.response?.data?.message || '분석에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSafetyBadgeClass = (safety) => {
    switch (safety) {
      case 'safe': return 'medicine__safety-badge--safe';
      case 'caution': return 'medicine__safety-badge--caution';
      case 'danger': return 'medicine__safety-badge--danger';
      default: return '';
    }
  };

  const getSafetyText = (safety) => {
    switch (safety) {
      case 'safe': return '✅ 안전';
      case 'caution': return '⚠️ 주의 필요';
      case 'danger': return '🚨 위험';
      default: return '';
    }
  };

  return (
    <div className="medicine">
      <header className="medicine__header">
        <h1 className="medicine__title">복용 중인 약</h1>
        <p className="medicine__subtitle">QR 코드 스캔 또는 직접 검색하여 등록하세요</p>
      </header>

      <div className="medicine__tabs">
        <button
          className={`medicine__tab ${activeTab === 'list' ? 'medicine__tab--active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          📋 내 약 목록 ({medicines.length})
        </button>
        <button
          className={`medicine__tab ${activeTab === 'add' ? 'medicine__tab--active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          ➕ 내 약 추가
        </button>
      </div>

      {/* 내 약 추가 탭 내부의 서브탭 */}
      {activeTab === 'add' && (
        <div className="medicine__sub-tabs">
          <button
            className={`medicine__sub-tab ${addSubTab === 'medicine' ? 'medicine__sub-tab--active' : ''}`}
            onClick={() => setAddSubTab('medicine')}
          >
            💊 의약품 추가
          </button>
          <button
            className={`medicine__sub-tab ${addSubTab === 'healthfood' ? 'medicine__sub-tab--active' : ''}`}
            onClick={() => setAddSubTab('healthfood')}
          >
            🥗 건강기능식품 추가
          </button>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="medicine__list">
          {isLoading ? (
            <p className="medicine__loading">로딩 중...</p>
          ) : medicines.length === 0 ? (
            <div className="medicine__empty">
              <p>등록된 약이 없습니다.</p>
              <button onClick={() => setActiveTab('add')} className="medicine__add-btn">
                약 추가하기
              </button>
            </div>
          ) : (
            <>
              {/* 🔴 Phase 1: 약품 성분 분석 레이더 차트 */}
              <MedicineRadarChart medicines={medicines} />

              {/* 🟡 Phase 1: 복용 시간표 */}
              <MedicineSchedule medicines={medicines} />

              {/* 🟢 Phase 2: 한 줄 상호작용 분석 */}
              <MedicineCorrelationSummary medicines={medicines} />

              <div className="medicine__analyze-section">
                <button
                  className="medicine__analyze-all-btn"
                  onClick={handleAnalyzeAll}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? '🔄 분석 중...' : '🔬 내 약 종합 분석하기'}
                </button>
                <p className="medicine__analyze-desc">
                  복용 중인 모든 약물의 상호작용을 AI가 분석합니다
                </p>
              </div>

              {showAnalysis && analysisResult && (
                <div className="medicine__analysis-modal">
                  <div className="medicine__analysis-content">
                    <div className="medicine__analysis-header">
                      <h2>💊 내 약 종합 분석 결과</h2>
                      <button
                        className="medicine__close-btn"
                        onClick={() => setShowAnalysis(false)}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="medicine__analysis-body">
                      {/* 전체 안전도 */}
                      <div className="medicine__overall-safety">
                        <div className={`medicine__safety-badge ${getSafetyBadgeClass(analysisResult.analysis.overallSafety)}`}>
                          {getSafetyText(analysisResult.analysis.overallSafety)}
                        </div>
                        <div className="medicine__safety-score">
                          안전도 점수: <strong>{analysisResult.analysis.overallScore}</strong>/100
                        </div>
                      </div>

                      {/* 종합 평가 */}
                      <div className="medicine__summary-section">
                        <h3>📋 종합 평가</h3>
                        <p className="medicine__summary-text">{analysisResult.analysis.summary}</p>
                      </div>

                      {/* 위험한 조합 */}
                      {analysisResult.analysis.dangerousCombinations && analysisResult.analysis.dangerousCombinations.length > 0 && (
                        <div className="medicine__danger-section">
                          <h3>🚨 위험한 조합 ({analysisResult.analysis.dangerousCombinations.length}개)</h3>
                          {analysisResult.analysis.dangerousCombinations.map((combo, idx) => (
                            <div key={idx} className="medicine__interaction-card medicine__interaction-card--danger">
                              <h4>{combo.drug1} ⚡ {combo.drug2}</h4>
                              <p className="medicine__interaction-desc">{combo.interaction}</p>
                              <div className="medicine__recommendation">
                                💡 <strong>권장사항:</strong> {combo.recommendation}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 주의 필요 조합 */}
                      {analysisResult.analysis.cautionCombinations && analysisResult.analysis.cautionCombinations.length > 0 && (
                        <div className="medicine__caution-section">
                          <h3>⚠️ 주의 필요 ({analysisResult.analysis.cautionCombinations.length}개)</h3>
                          {analysisResult.analysis.cautionCombinations.map((combo, idx) => (
                            <div key={idx} className="medicine__interaction-card medicine__interaction-card--caution">
                              <h4>{combo.drug1} + {combo.drug2}</h4>
                              <p className="medicine__interaction-desc">{combo.interaction}</p>
                              <div className="medicine__recommendation">
                                💡 <strong>권장사항:</strong> {combo.recommendation}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 긍정적 효과 */}
                      {analysisResult.analysis.synergisticEffects && analysisResult.analysis.synergisticEffects.length > 0 && (
                        <div className="medicine__synergy-section">
                          <h3>✨ 긍정적 효과 ({analysisResult.analysis.synergisticEffects.length}개)</h3>
                          {analysisResult.analysis.synergisticEffects.map((effect, idx) => (
                            <div key={idx} className="medicine__interaction-card medicine__interaction-card--safe">
                              <h4>{effect.drugs.join(' + ')}</h4>
                              <p className="medicine__benefit">💚 {effect.benefit}</p>
                              <p className="medicine__interaction-desc">{effect.description}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 복용 가이드 */}
                      {analysisResult.analysis.recommendations && analysisResult.analysis.recommendations.length > 0 && (
                        <div className="medicine__guide-section">
                          <h3>📌 복용 가이드</h3>
                          <ul className="medicine__recommendations">
                            {analysisResult.analysis.recommendations.map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 데이터 출처 */}
                      <div className="medicine__data-sources">
                        <h4>📊 데이터 출처</h4>
                        <ul>
                          {analysisResult.dataSources.map((source, idx) => (
                            <li key={idx}>{source}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {medicines.map((med) => (
                <div
                  key={med.id}
                  className="medicine__card"
                  onClick={() => {
                    setSelectedMedicineDetail(med);
                    setShowMedicineDetailPopup(true);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="medicine__card-header">
                    <h3 className="medicine__card-title">{med.itemName || med.name || '약품명 미확인'}</h3>
                    <button
                      className="medicine__delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMedicine(med.id);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                  {med.drug_class && (
                    <p className="medicine__card-info">제조사: {med.drug_class}</p>
                  )}
                  {med.dosage && (
                    <p className="medicine__card-info">복용량: {med.dosage}</p>
                  )}
                  {med.frequency && (
                    <p className="medicine__card-info">복용 빈도: {med.frequency}</p>
                  )}
                  <p className="medicine__card-date">
                    등록일: {new Date(med.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === 'add' && addSubTab === 'medicine' && (
        <div className="medicine__add">
          <section className="medicine__section">
            <h2 className="medicine__section-title">📸 약 촬영하기</h2>
            <p className="medicine__section-desc">
              약 봉지, 처방전, 알약 등을 촬영하면 AI가 자동으로 인식합니다
            </p>
            
            <div className="medicine__capture-buttons">
              {/* 숨겨진 파일 입력들 */}
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
                className="medicine__capture-btn"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isAnalyzingImage}
              >
                📷 카메라로 촬영
              </button>
              <button
                className="medicine__capture-btn medicine__capture-btn--secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzingImage}
              >
                🖼️ 갤러리에서 선택
              </button>
            </div>

            {/* 이미지 분석 중 */}
            {isAnalyzingImage && (
              <div className="medicine__analyzing">
                <div className="medicine__analyzing-spinner"></div>
                <p>🔍 AI가 약품을 분석하고 있습니다...</p>
              </div>
            )}

            {/* 촬영된 이미지 미리보기 */}
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

            {/* 분석 결과 (약품이 없거나 오류인 경우) */}
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

            {/* 약품 선택 팝업 */}
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
                      (검증됨: {imageAnalysisResult.summary.verified}개, 
                      미검증: {imageAnalysisResult.summary.unverified}개)
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
                          {selectedMedicines[index] ? '☑️' : '⬜'}
                        </div>
                        <div className="medicine__select-info">
                          <h4>{medicine.apiMatch?.itemName || medicine.detectedName}</h4>
                          <p className="medicine__select-manufacturer">
                            {medicine.apiMatch?.entpName || medicine.manufacturer || '제조사 정보 없음'}
                          </p>
                          <div className="medicine__select-badges">
                            {medicine.verified ? (
                              <span className="medicine__badge medicine__badge--verified">✅ 검증됨</span>
                            ) : (
                              <span className="medicine__badge medicine__badge--unverified">⚠️ 미검증</span>
                            )}
                            <span className="medicine__badge medicine__badge--confidence">
                              신뢰도: {Math.round(medicine.confidence * 100)}%
                            </span>
                            {medicine.type && (
                              <span className="medicine__badge">{medicine.type}</span>
                            )}
                          </div>
                          {medicine.shape && (
                            <p className="medicine__select-detail">
                              형태: {medicine.shape} {medicine.color && `/ 색상: ${medicine.color}`}
                            </p>
                          )}
                          {medicine.apiMatch?.efcyQesitm && (
                            <p className="medicine__select-efficacy">
                              효능: {medicine.apiMatch.efcyQesitm.substring(0, 80)}...
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="medicine__select-popup-footer">
                    <span className="medicine__selected-count">
                      {selectedMedicines.filter(Boolean).length}개 선택됨
                    </span>
                    <button
                      className="medicine__add-selected-btn"
                      onClick={handleAddSelectedMedicines}
                      disabled={isLoading || selectedMedicines.filter(Boolean).length === 0}
                    >
                      {isLoading ? '등록 중...' : `선택한 약 등록하기 (${selectedMedicines.filter(Boolean).length}개)`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="medicine__section">
            <h2 className="medicine__section-title">🔍 약품명 또는 질병 검색</h2>
            <p className="medicine__section-desc">약품명, 증상/질병, 제조사로 검색하세요 (예: 타이레놀, 두통, 감기, 일동제약)</p>
            
            <div className="medicine__search">
              <input
                type="text"
                className="medicine__search-input"
                placeholder="약품명, 질병, 제조사 입력 (예: 타이레놀, 두통, 일동제약)"
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

            <div className="medicine__search-results">
              {/* 탭 이동 안내 */}
              {tabSuggestion && (
                <div className="medicine__tab-suggestion" style={{
                  backgroundColor: '#FFF3E0',
                  border: '1px solid #FF9800',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                }}>
                  <p style={{ margin: 0, color: '#E65100', fontWeight: 'bold', fontSize: '14px' }}>
                    🔔 {tabSuggestion.message}
                  </p>
                  {tabSuggestion.foundCount > 0 && (
                    <p style={{ margin: '8px 0 0', color: '#666', fontSize: '13px' }}>
                      ✅ {tabSuggestion.foundCount}건의 결과가 {tabSuggestion.correctTab === 'healthfood' ? '건강기능식품' : '의약품'} 탭에서 발견되었습니다.
                    </p>
                  )}
                  <button
                    onClick={() => handleTabSwitch(tabSuggestion.correctTab, searchKeyword)}
                    style={{
                      marginTop: '12px',
                      padding: '8px 16px',
                      backgroundColor: '#FF9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    {tabSuggestion.correctTab === 'healthfood' ? '🥗 건강기능식품 탭으로 이동' : '💊 의약품 탭으로 이동'}
                  </button>
                </div>
              )}
              
              {searchResults.length > 0 ? (
                <>
                  <p className="medicine__results-count">전체 검색 결과: {searchResults.length}건</p>
                  <p className="medicine__results-info" style={{ fontSize: '12px', color: '#666', marginTop: '-8px', marginBottom: '12px' }}>
                    💡 약품명, 효능(질병), 제조사로 검색된 결과입니다. 효능을 확인하고 선택하세요.
                  </p>
                  {(() => {
                    const totalPages = Math.ceil(searchResults.length / itemsPerPage);
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const currentResults = searchResults.slice(startIndex, endIndex);
                    
                    return (
                      <>
                        {currentResults.map((result, index) => (
                          <div key={result.itemSeq || index} className="medicine__result-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
                              <div style={{ flex: 1 }}>
                                <h4 style={{ margin: '0 0 4px 0' }}>{result.itemName}</h4>
                                <p className="medicine__result-manufacturer" style={{ margin: '0 0 8px 0' }}>
                                  {result.entpName}
                                </p>
                              </div>
                              {/* 캐시 상태 배지 */}
                              {result._isFromCache && (
                                <div style={{
                                  backgroundColor: '#E8F5E9',
                                  color: '#2E7D32',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  whiteSpace: 'nowrap'
                                }}>
                                  🔄 캐시
                                </div>
                              )}
                            </div>
                            
                            {/* 간략 효능 (2줄 정도) */}
                            {result.efcyQesitm && (
                              <div className="medicine__result-efficacy" style={{ marginBottom: '12px' }}>
                                <p style={{ margin: '0', fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
                                  {result.efcyQesitm.length > 100 
                                    ? `${result.efcyQesitm.substring(0, 100)}...` 
                                    : result.efcyQesitm}
                                </p>
                              </div>
                            )}
                            
                            <button
                              className="medicine__result-add-btn"
                              onClick={() => handleAddMedicine(result)}
                              disabled={isLoading}
                            >
                              {isLoading ? '추가 중...' : '추가'}
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
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                  key={page}
                                  className={`medicine__page-num ${currentPage === page ? 'medicine__page-num--active' : ''}`}
                                  onClick={() => setCurrentPage(page)}
                                >
                                  {page}
                                </button>
                              ))}
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
                    검색 결과가 없습니다. 다른 키워드로 시도해보세요.
                  </p>
                )
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'add' && addSubTab === 'healthfood' && (
        <div className="medicine__add">
          <section className="medicine__section">
            <h2 className="medicine__section-title">🥗 건강기능식품 검색</h2>
            <p className="medicine__section-desc">
              건강기능식품명, 원료명, 제조사로 검색하세요<br />
              (예: 오메가3, 비타민, 유산균, 홍삼, 루테인, 프로바이오틱스)
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

            <div className="medicine__search-results">
              {/* 탭 이동 안내 */}
              {healthFoodTabSuggestion && (
                <div className="medicine__tab-suggestion" style={{
                  backgroundColor: '#E3F2FD',
                  border: '1px solid #2196F3',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                }}>
                  <p style={{ margin: 0, color: '#1565C0', fontWeight: 'bold', fontSize: '14px' }}>
                    🔔 {healthFoodTabSuggestion.message}
                  </p>
                  {healthFoodTabSuggestion.foundCount > 0 && (
                    <p style={{ margin: '8px 0 0', color: '#666', fontSize: '13px' }}>
                      ✅ {healthFoodTabSuggestion.foundCount}건의 결과가 의약품 탭에서 발견되었습니다.
                    </p>
                  )}
                  <button
                    onClick={() => handleTabSwitch(healthFoodTabSuggestion.correctTab, healthFoodKeyword)}
                    style={{
                      marginTop: '12px',
                      padding: '8px 16px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    💊 의약품 탭으로 이동
                  </button>
                </div>
              )}
              
              {healthFoodResults.length > 0 ? (
                <>
                  <p className="medicine__results-count">전체 검색 결과: {healthFoodResults.length}건</p>
                  <p className="medicine__results-info" style={{ fontSize: '12px', color: '#666', marginTop: '-8px', marginBottom: '12px' }}>
                    🥗 건강기능식품 정보입니다. 기능성 내용을 확인하고 선택하세요.
                    {healthFoodResults.some(r => r._isAIGenerated) && (
                      <span style={{ display: 'block', color: '#FF9800', marginTop: '4px' }}>
                        ⚠️ AI가 실제 제품 정보를 기반으로 생성한 결과가 포함되어 있습니다.
                      </span>
                    )}
                  </p>
                  {(() => {
                    const totalPages = Math.ceil(healthFoodResults.length / itemsPerPage);
                    const startIndex = (healthFoodPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const currentResults = healthFoodResults.slice(startIndex, endIndex);
                    
                    return (
                      <>
                        {currentResults.map((result, index) => (
                          <div key={result.itemSeq || index} className="medicine__result-card medicine__result-card--healthfood">
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                              <div className="medicine__result-badge" style={{ 
                                display: 'inline-block', 
                                backgroundColor: '#4CAF50', 
                                color: 'white', 
                                padding: '2px 8px', 
                                borderRadius: '12px', 
                                fontSize: '11px',
                              }}>
                                🥗 건강기능식품
                              </div>
                              {result._isFromCache && (
                                <div style={{ 
                                  display: 'inline-block', 
                                  backgroundColor: '#E8F5E9', 
                                  color: '#2E7D32', 
                                  padding: '2px 8px', 
                                  borderRadius: '12px', 
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                }}>
                                  🔄 캐시
                                </div>
                              )}
                              {result._isAIGenerated && (
                                <div style={{ 
                                  display: 'inline-block', 
                                  backgroundColor: '#FF9800', 
                                  color: 'white', 
                                  padding: '2px 8px', 
                                  borderRadius: '12px', 
                                  fontSize: '11px',
                                }}>
                                  🤖 AI 추천
                                </div>
                              )}
                            </div>
                            
                            <h4 style={{ margin: '0 0 4px 0' }}>{result.itemName}</h4>
                            <p className="medicine__result-manufacturer" style={{ margin: '0 0 8px 0' }}>
                              {result.entpName}
                            </p>
                            
                            {/* 간략 기능성 정보 */}
                            {result.efcyQesitm && (
                              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
                                {result.efcyQesitm.length > 100 
                                  ? `${result.efcyQesitm.substring(0, 100)}...` 
                                  : result.efcyQesitm}
                              </p>
                            )}
                            
                            {result._rawMaterial && (
                              <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#999' }}>
                                주원료: {result._rawMaterial.length > 60 ? result._rawMaterial.substring(0, 60) + '...' : result._rawMaterial}
                              </p>
                            )}
                            {result.efcyQesitm && (
                              <div className="medicine__result-efficacy">
                                <strong style={{ color: '#4CAF50' }}>기능성:</strong>
                                <p style={{ marginTop: '4px', fontSize: '13px', lineHeight: '1.5' }}>
                                  {result.efcyQesitm.length > 150 
                                    ? `${result.efcyQesitm.substring(0, 150)}...` 
                                    : result.efcyQesitm}
                                </p>
                              </div>
                            )}
                            <button
                              className="medicine__result-add-btn"
                              onClick={() => handleAddMedicine(result)}
                              disabled={isLoading}
                            >
                              {isLoading ? '추가 중...' : '추가'}
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
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                  key={page}
                                  className={`medicine__page-num ${healthFoodPage === page ? 'medicine__page-num--active' : ''}`}
                                  onClick={() => setHealthFoodPage(page)}
                                >
                                  {page}
                                </button>
                              ))}
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
                    검색 결과가 없습니다. 다른 키워드로 시도해보세요.<br />
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      예: 오메가3, 비타민D, 유산균, 홍삼, 루테인
                    </span>
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
    </div>
  );
};

export default Medicine;
