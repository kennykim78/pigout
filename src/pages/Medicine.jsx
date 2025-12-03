import { useState, useEffect } from 'react';
import { useMedicineStore } from '../store/medicineStore';
import { getMyMedicines, scanMedicineQR, searchMedicine, searchHealthFood, deleteMedicine, addMedicine as addMedicineAPI, analyzeAllMedicines } from '../services/api';
import { Scanner } from '@yudiel/react-qr-scanner';
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

  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    setLoading(true);
    try {
      const data = await getMyMedicines(true);
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

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setCurrentPage(1);
    setTabSuggestion(null); // 이전 안내 초기화
    try {
      console.log('[검색 시작] 키워드:', searchKeyword);
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
    setActiveTab(targetTab);
    if (targetTab === 'healthfood') {
      setHealthFoodKeyword(keyword);
      setTabSuggestion(null);
      // 자동 검색
      setTimeout(() => {
        document.querySelector('.medicine__search-btn')?.click();
      }, 100);
    } else if (targetTab === 'add') {
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
          내 약 목록 ({medicines.length})
        </button>
        <button
          className={`medicine__tab ${activeTab === 'add' ? 'medicine__tab--active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          💊 의약품
        </button>
        <button
          className={`medicine__tab ${activeTab === 'healthfood' ? 'medicine__tab--active' : ''}`}
          onClick={() => setActiveTab('healthfood')}
        >
          🥗 건강기능식품
        </button>
      </div>

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
                <div key={med.id} className="medicine__card">
                  <div className="medicine__card-header">
                    <h3 className="medicine__card-title">{med.name}</h3>
                    <button
                      className="medicine__delete-btn"
                      onClick={() => handleDeleteMedicine(med.id)}
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

      {activeTab === 'add' && (
        <div className="medicine__add">
          <section className="medicine__section">
            <h2 className="medicine__section-title">📱 QR 코드 스캔</h2>
            <p className="medicine__section-desc">약 포장의 QR 코드를 스캔하세요</p>
            
            <div className="medicine__qr-mode-buttons">
              <button
                className="medicine__scan-btn"
                onClick={() => {
                  setShowQrScanner(true);
                  setScanMode('camera');
                }}
              >
                📷 카메라로 스캔하기
              </button>
              <button
                className="medicine__scan-btn medicine__scan-btn--secondary"
                onClick={() => {
                  setShowQrScanner(!showQrScanner);
                  setScanMode('manual');
                }}
              >
                {showQrScanner && scanMode === 'manual' ? '✕ 입력 닫기' : '⌨️ 직접 입력하기'}
              </button>
            </div>

            {showQrScanner && scanMode === 'camera' && (
              <div className="medicine__qr-fullscreen">
                <div className="medicine__qr-header">
                  <h2>QR 코드 스캔</h2>
                  <button
                    className="medicine__qr-close-btn"
                    onClick={handleCloseQrScanner}
                  >
                    <span className="material-symbols-rounded">close</span>
                  </button>
                </div>

                {!scannedMedicine && !qrScanError && (
                  <>
                    <div className="medicine__qr-scanner-area">
                      <Scanner
                        onScan={handleCameraScan}
                        onError={(error) => {
                          console.error('Scanner error:', error);
                          setQrScanError('카메라를 사용할 수 없습니다.');
                        }}
                        constraints={{
                          facingMode: 'environment'
                        }}
                        styles={{
                          container: {
                            width: '100%',
                            height: '100%',
                          },
                          video: {
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }
                        }}
                      />
                      <div className="medicine__qr-overlay">
                        <div className="medicine__qr-frame">
                          <div className="medicine__qr-corner medicine__qr-corner--tl"></div>
                          <div className="medicine__qr-corner medicine__qr-corner--tr"></div>
                          <div className="medicine__qr-corner medicine__qr-corner--bl"></div>
                          <div className="medicine__qr-corner medicine__qr-corner--br"></div>
                        </div>
                      </div>
                    </div>
                    <div className="medicine__qr-guide">
                      <p>약 포장의 QR 코드를 프레임 안에 맞춰주세요</p>
                      {isProcessingQR && <p className="medicine__qr-processing">🔄 인식 중...</p>}
                    </div>
                  </>
                )}

                {qrScanError && (
                  <div className="medicine__qr-error">
                    <div className="medicine__qr-error-icon">❌</div>
                    <p>{qrScanError}</p>
                    <button
                      className="medicine__qr-retry-btn"
                      onClick={handleRescan}
                    >
                      다시 스캔하기
                    </button>
                  </div>
                )}

                {scannedMedicine && (
                  <div className="medicine__qr-result">
                    <div className="medicine__qr-result-icon">✅</div>
                    <h3>약 정보를 찾았습니다!</h3>
                    
                    <div className="medicine__qr-result-card">
                      <h4>{scannedMedicine.parsedInfo.medicineName}</h4>
                      {scannedMedicine.parsedInfo.companyName && (
                        <p className="medicine__qr-result-company">
                          제조사: {scannedMedicine.parsedInfo.companyName}
                        </p>
                      )}
                      {scannedMedicine.parsedInfo.productCode && (
                        <p className="medicine__qr-result-code">
                          품목코드: {scannedMedicine.parsedInfo.productCode}
                        </p>
                      )}
                    </div>

                    <div className="medicine__qr-result-buttons">
                      <button
                        className="medicine__qr-rescan-btn"
                        onClick={handleRescan}
                      >
                        다시 스캔
                      </button>
                      <button
                        className="medicine__qr-add-btn"
                        onClick={handleAddScannedMedicine}
                        disabled={isLoading}
                      >
                        {isLoading ? '등록 중...' : '약 등록하기'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showQrScanner && scanMode === 'manual' && (
              <div className="medicine__qr-input">
                <textarea
                  className="medicine__textarea"
                  placeholder="QR 코드 텍스트를 붙여넣으세요&#10;예:&#10;품목명: 타이레놀 500mg&#10;업체명: Johnson & Johnson&#10;품목기준코드: 8806429021102"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  rows={6}
                />
                <button
                  className="medicine__submit-btn"
                  onClick={() => handleQrScan()}
                  disabled={isLoading}
                >
                  {isLoading ? '처리 중...' : '추가하기'}
                </button>
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
                            <h4>{result.itemName}</h4>
                            <p className="medicine__result-manufacturer">제조사: {result.entpName}</p>
                            {result.efcyQesitm && (
                              <div className="medicine__result-efficacy">
                                <strong style={{ color: '#4CAF50' }}>효능/효과:</strong>
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

      {activeTab === 'healthfood' && (
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
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
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
                            <h4>{result.itemName}</h4>
                            <p className="medicine__result-manufacturer">제조사: {result.entpName}</p>
                            {result._rawMaterial && (
                              <p className="medicine__result-raw-material" style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                                원료명: {result._rawMaterial}
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
    </div>
  );
};

export default Medicine;
