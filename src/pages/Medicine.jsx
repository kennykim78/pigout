import { useState, useEffect } from 'react';
import { useMedicineStore } from '../store/medicineStore';
import { getMyMedicines, scanMedicineQR, searchMedicine, deleteMedicine, addMedicine as addMedicineAPI } from '../services/api';
import './Medicine.scss';

const Medicine = () => {
  const { medicines, setMedicines, addMedicine: addToStore, deleteMedicine: removeFromStore, isLoading, setLoading, setError } = useMedicineStore();
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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

  const handleQrScan = async () => {
    if (!qrInput.trim()) {
      alert('QR 데이터를 입력하세요.');
      return;
    }

    setLoading(true);
    try {
      const result = await scanMedicineQR(qrInput);
      addToStore(result.medicineRecord);
      setQrInput('');
      setShowQrScanner(false);
      alert(`${result.parsedInfo.medicineName} 추가 완료!`);
    } catch (error) {
      console.error('QR scan failed:', error);
      alert(error.response?.data?.message || 'QR 스캔에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setCurrentPage(1);
    try {
      console.log('[검색 시작] 키워드:', searchKeyword);
      const results = await searchMedicine(searchKeyword);
      console.log('[검색 완료] 결과:', results);
      console.log('[검색 완료] 결과 타입:', typeof results);
      console.log('[검색 완료] 배열 여부:', Array.isArray(results));
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      console.error('Error details:', error.response?.data);
      setError('검색에 실패했습니다.');
      setSearchResults([]);
    } finally {
      setLoading(false);
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
    } catch (error) {
      console.error('Delete failed:', error);
      alert('삭제에 실패했습니다.');
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
          약 추가
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
            medicines.map((med) => (
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
            ))
          )}
        </div>
      )}

      {activeTab === 'add' && (
        <div className="medicine__add">
          <section className="medicine__section">
            <h2 className="medicine__section-title">📱 QR 코드 스캔</h2>
            <p className="medicine__section-desc">약 포장의 QR 코드를 스캔하세요</p>
            
            <button
              className="medicine__scan-btn"
              onClick={() => setShowQrScanner(!showQrScanner)}
            >
              {showQrScanner ? 'QR 입력 닫기' : 'QR 데이터 입력'}
            </button>

            {showQrScanner && (
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
                  onClick={handleQrScan}
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
    </div>
  );
};

export default Medicine;
