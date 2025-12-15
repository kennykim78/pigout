import { useState, useEffect, useRef } from 'react';
import { useMedicineStore } from '../store/medicineStore';
import { getMyMedicines, searchMedicine, searchHealthFood, deleteMedicine, addMedicine as addMedicineAPI, analyzeMedicineImage, analyzeAllMedicinesStream } from '../services/api';
import MedicineRadarChart from '../components/MedicineRadarChart';
import MedicineSchedule from '../components/MedicineSchedule';
import MedicineCorrelationSummary from '../components/MedicineCorrelationSummary';
import MedicineInteractionNetwork from '../components/MedicineInteractionNetwork';
import MedicineTimingOptimizer from '../components/MedicineTimingOptimizer';
import DosageBasedRiskAnalyzer from '../components/DosageBasedRiskAnalyzer';
import MedicineDetailPopup from '../components/MedicineDetailPopup';
import ImageSourceModal from '../components/ImageSourceModal';
import MedicineAnalyzedInfo from '../components/MedicineAnalyzedInfo';
import './Medicine.scss';

const Medicine = () => {
  const { medicines, setMedicines, addMedicine: addToStore, deleteMedicine: removeFromStore, isLoading, setLoading, setError } = useMedicineStore();
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

  // 🆕 스트리밍 분석 상태
  const [streamingStages, setStreamingStages] = useState([]);
  const [currentStage, setCurrentStage] = useState(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamError, setStreamError] = useState(null);
  const abortRef = useRef(null);
  
  // 건강기능식품 탭용 상태
  const [healthFoodKeyword, setHealthFoodKeyword] = useState('');
  const [healthFoodResults, setHealthFoodResults] = useState([]);
  const [hasSearchedHealthFood, setHasSearchedHealthFood] = useState(false);
  const [healthFoodPage, setHealthFoodPage] = useState(1);
  
  // 탭 이동 안내 상태
  const [tabSuggestion, setTabSuggestion] = useState(null);
  const [healthFoodTabSuggestion, setHealthFoodTabSuggestion] = useState(null);
  
  // 📸 AI 이미지 분석 상태
  const [showImageCapture, setShowImageCapture] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalysisResult, setImageAnalysisResult] = useState(null);
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  const [showMedicineSelectPopup, setShowMedicineSelectPopup] = useState(false);
  const [selectedMedicineDetail, setSelectedMedicineDetail] = useState(null);
  const [showMedicineDetailPopup, setShowMedicineDetailPopup] = useState(false);
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);
  // 약 추가 진행 상태 오버레이
  const [isAdding, setIsAdding] = useState(false);
  const [addProgress, setAddProgress] = useState(null);
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

  // 📸 이미지 압축 함수 (AI 분석용 - 텍스트 인식 최적화)
  // 목표: 100KB 이하, 최대 1280px (텍스트 선명도 유지)
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
          
          // 🔍 약품 텍스트 인식을 위한 최대 크기: 1280px
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
          
          // 품질을 조정하면서 목표 크기 이하로 압축
          let quality = 0.9;
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (blob.size <= maxSizeInBytes || quality <= 0.3) {
                  // 목표 크기 달성 또는 최소 품질(0.3)에 도달
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  console.log(`[이미지 압축] 완료: ${file.size} → ${compressedFile.size} bytes (quality: ${quality.toFixed(1)})`);
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

  // 📸 이미지 파일 선택 핸들러
  const handleImageFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('[이미지 선택] 파일 없음');
      return;
    }

    console.log('[이미지 선택] 원본 파일:', {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeKB: Math.round(file.size / 1024) + 'KB',
    });

    // 🔥 모든 이미지 압축 (AI 분석용 - 저장 안 함)
    console.log('[이미지 압축] 시작... (목표: 100KB, 최대 1280px)');
    let processedFile = file;
    try {
      processedFile = await compressImage(file, 100 * 1024); // 100KB
      console.log('[이미지 압축] 성공 -', {
        원본: Math.round(file.size / 1024) + 'KB',
        압축: Math.round(processedFile.size / 1024) + 'KB',
        절감률: Math.round((1 - processedFile.size / file.size) * 100) + '%',
      });
    } catch (error) {
      console.error('[이미지 압축] 실패:', error);
      alert('이미지 압축에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    // 파일을 Base64로 변환
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result.split(',')[1]; // data:image/... 부분 제거
      const mimeType = processedFile.type || 'image/jpeg';
      
      console.log('[이미지 변환] Base64 완료:', {
        mimeType,
        base64Length: base64Data.length,
        estimatedKB: Math.round(base64Data.length * 0.75 / 1024) + 'KB',
      });
      
      setCapturedImage(reader.result);
      await analyzeImageWithAI(base64Data, mimeType);
    };
    reader.onerror = (error) => {
      console.error('[이미지 선택] 파일 읽기 실패:', error);
    };
    reader.readAsDataURL(processedFile);
  };

  // 📸 AI로 이미지 분석
  const analyzeImageWithAI = async (base64Data, mimeType) => {
    setIsAnalyzingImage(true);
    setImageAnalysisResult(null);
    
    try {
      console.log('[이미지 분석] 시작 - Base64 길이:', base64Data.length, 'MIME:', mimeType);
      const result = await analyzeMedicineImage(base64Data, mimeType);
      console.log('[이미지 분석] 결과:', result);
      
      setImageAnalysisResult(result);
      
      if (result.success && result.verifiedMedicines?.length > 0) {
        console.log('[이미지 분석] 검증된 약품 개수:', result.verifiedMedicines.length);
        // 감지된 약품이 있으면 선택 팝업 표시
        setSelectedMedicines(result.verifiedMedicines.map(m => m.verified)); // 검증된 약품만 기본 선택
        setShowMedicineSelectPopup(true);
      } else {
        console.warn('[이미지 분석] 검증된 약품 없음');
      }
    } catch (error) {
      console.error('[이미지 분석] 실패:', error);
      console.error('[이미지 분석] 에러 상세:', error.response?.data);
      setImageAnalysisResult({
        success: false,
        message: error.response?.data?.message || '이미지 분석에 실패했습니다. 다시 시도해주세요.',
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

  // 📸 이미지 인식 약품 상세정보 조회 (등록 시점에만 호출)
  const fetchMedicineDetailForRegistration = async (itemSeq, itemName) => {
    if (!itemSeq && !itemName) return null;

    try {
      // itemSeq가 있으면 그것을 우선 사용, 없으면 itemName으로 검색
      const keyword = itemSeq || itemName;
      const response = await searchMedicine(keyword, 1);
      const results = Array.isArray(response) ? response : (response?.results || []);
      
      if (results.length === 0) return null;

      // itemSeq가 있는 경우 정확 매칭 시도
      if (itemSeq) {
        const exactMatch = results.find((item) => item.itemSeq === itemSeq);
        if (exactMatch) return exactMatch;
      }
      
      // 그 외에는 첫 번째 결과 사용
      return results[0];
    } catch (error) {
      console.error('[이미지 등록] 상세정보 조회 실패:', error);
      return null;
    }
  };

  // 📸 선택한 약품들 일괄 등록
  const handleAddSelectedMedicines = async () => {
    if (!imageAnalysisResult?.verifiedMedicines) return;
    
    const medicinesToAdd = imageAnalysisResult.verifiedMedicines.filter((_, idx) => selectedMedicines[idx]);
    
    if (medicinesToAdd.length === 0) {
      alert('등록할 약품을 선택해주세요.');
      return;
    }

    // 🆕 제한 체크
    const TOTAL_MAX = 15; // 의약품 최대 10개 + 건강기능식품 최대 5개
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
        // API Match 데이터가 있으면 사용, 없으면 AI 감지 데이터 기본값 사용
        const baseItemSeq = medicine.apiMatch?.itemSeq;
        const baseItemName = medicine.apiMatch?.itemName || medicine.detectedName;
        const baseEntpName = medicine.apiMatch?.entpName || medicine.manufacturer || '(정보 없음)';

        console.log(`[이미지 등록] ${baseItemName} 상세정보 조회 시작 (itemSeq: ${baseItemSeq})`);
        
        // 등록 직전에 API에서 최신 상세 정보 조회
        const detailData = await fetchMedicineDetailForRegistration(baseItemSeq, baseItemName);

        const medicineData = {
          itemName: detailData?.itemName || baseItemName,
          entpName: detailData?.entpName || baseEntpName,
          itemSeq: detailData?.itemSeq || baseItemSeq,
          // 🆕 상세 정보는 등록 시점에서만 조회
          efcyQesitm: detailData?.efcyQesitm,
          useMethodQesitm: detailData?.useMethodQesitm,
          atpnWarnQesitm: detailData?.atpnWarnQesitm,
          intrcQesitm: detailData?.intrcQesitm,
          seQesitm: detailData?.seQesitm,
          depositMethodQesitm: detailData?.depositMethodQesitm,
          isHealthFood: addSubTab === 'healthfood', // 🆕 의약품 vs 건강기능식품 구분
        };

        console.log(`[이미지 등록] ${baseItemName} 등록 데이터:`, {
          itemName: medicineData.itemName,
          entpName: medicineData.entpName,
          hasEfcyQesitm: !!medicineData.efcyQesitm,
          hasUseMethod: !!medicineData.useMethodQesitm,
        });

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
        
        // 200개 이상 결과 알럿
        if (results.length >= 200) {
          alert('검색결과가 200개 이상입니다.\n정확한 명칭이나, 제조사 등 세부적으로 검색바랍니다.');
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
        
        // 200개 이상 결과 알럿
        if (results.length >= 200) {
          alert('검색결과가 200개 이상입니다.\n정확한 명칭이나, 제조사 등 세부적으로 검색바랍니다.');
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

      // 🆕 제한 로직: 현재 탭 기준 구분
      const isHealthFood = addSubTab === 'healthfood';
      const currentList = isHealthFood ? healthFoodResults : searchResults;
      
      // 현재 선택된 탭에서의 약 개수 (이미 DB에 등록된 약은 제한하지 않음)
      // 대신 UI에서 현재 보여주는 리스트 기준으로 체크
      const MEDICINE_MAX = 10;
      const HEALTH_FOOD_MAX = 5;
      
      // 제한 체크: 현재 탭에서 이미 많은 약이 등록되었는지 확인
      // 실제로는 medicines 배열의 전체 개수로 제한 (모든 약이 섞여있기 때문)
      const totalMedicines = medicines.length;
      
      // 의약품과 건강기능식품이 구분되지 않으므로, 총 개수 기준으로 제한
      const TOTAL_MAX = MEDICINE_MAX + HEALTH_FOOD_MAX; // 총 15개
      
      if (totalMedicines >= TOTAL_MAX) {
        alert(`최대 ${TOTAL_MAX}개까지만 등록 가능합니다.\n(의약품 최대 10개, 건강기능식품 최대 5개)`);
        setIsAdding(false);
        setAddProgress(null);
        return;
      }
      
      // 추가적인 경고: 의약품/건강기능식품 구분이 안 되므로 사용자에게 알림
      if (totalMedicines >= TOTAL_MAX - 2) {
        alert(`⚠️ 등록 가능한 약이 ${TOTAL_MAX - totalMedicines}개 남았습니다.`);
      }
      
      // 진행도 업데이트
      updateStep('name', 'done');
      updateStep('usage', 'active');
      updateStep('usage', 'done');
      updateStep('public', 'active');

      const result = await addMedicineAPI({
        itemName: medicine.itemName,
        entpName: medicine.entpName,
        itemSeq: medicine.itemSeq,
        efcyQesitm: medicine.efcyQesitm,
        isHealthFood: isHealthFood, // 🆕 의약품/건강기능식품 구분 정보 전달
      });

      updateStep('public', 'done');
      updateStep('register', 'active');
      
      // 🆕 추가된 약품의 타입 정보를 로컬에 저장 (DB에 저장될 때까지 임시)
      if (result.medicineRecord) {
        const medicineTypes = JSON.parse(sessionStorage.getItem('medicineTypes') || '{}');
        medicineTypes[result.medicineRecord.id] = isHealthFood ? 'healthfood' : 'medicine';
        sessionStorage.setItem('medicineTypes', JSON.stringify(medicineTypes));
      }
      
      console.log('약 추가 성공:', result);
      updateStep('register', 'done');
      setAddProgress((prev) => prev ? { ...prev, completed: true, success: true } : prev);
      
      // 목록 새로고침 (탭은 그대로 유지)
      await loadMedicines();
    } catch (error) {
      console.error('Add medicine failed:', error);
      updateStep('register', 'error');
      setAddProgress((prev) => prev ? { ...prev, completed: true, success: false, error: error.response?.data?.message || '약 추가에 실패했습니다.' } : prev);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddProgressClose = () => {
    setAddProgress(null);
    setIsAdding(false);
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

  // 복용 시간대 업데이트 핸들러
  const handleUpdateSchedule = async (medicineId, scheduleData) => {
    try {
      console.log('[Medicine] 복용 시간대 업데이트:', medicineId, scheduleData);
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/medicine/${medicineId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': localStorage.getItem('deviceId') || 'unknown',
        },
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) {
        throw new Error('복용 시간대 업데이트 실패');
      }

      const updatedMedicine = await response.json();
      console.log('[Medicine] 업데이트 완료:', updatedMedicine);

      // 로컬 상태 업데이트
      await loadMedicines();
      alert('복용 시간대가 수정되었습니다.');
    } catch (error) {
      console.error('[Medicine] 복용 시간대 업데이트 실패:', error);
      throw error;
    }
  };

  const handleAnalyzeAll = async () => {
    if (medicines.length === 0) {
      alert('복용 중인 약이 없습니다. 먼저 약을 추가해주세요.');
      return;
    }

    setIsAnalyzing(true);
    setStreamError(null);
    setStreamingStages([]);
    setStreamProgress(0);

    console.log('[약물 상관관계 분석] 스트리밍 시작...');

    const { abort } = analyzeAllMedicinesStream({
      onStart: (data) => {
        console.log('[Medicine 스트리밍] 시작:', data);
        setStreamingMessage(data.message);
        setStreamingStages(data.stages.map((name, idx) => ({
          stage: idx + 1,
          name,
          status: 'waiting'
        })));
      },
      onStage: (data) => {
        console.log('[Medicine 스트리밍] 단계:', data);
        setCurrentStage(data.stage);
        setStreamingMessage(data.message);
        
        // 진행률 계산 (4단계 기준)
        const totalStages = 4;
        const progressPerStage = 100 / totalStages;
        const baseProgress = (data.stage - 1) * progressPerStage;
        const stageProgress = data.status === 'complete' ? progressPerStage : progressPerStage * 0.5;
        setStreamProgress(Math.min(baseProgress + stageProgress, 100));
        
        setStreamingStages(prev => prev.map(s => 
          s.stage === data.stage 
            ? { ...s, status: data.status, message: data.message }
            : s.stage < data.stage 
              ? { ...s, status: 'complete' }
              : s
        ));
      },
      onPartial: (data) => {
        console.log('[Medicine 스트리밍] 부분 데이터:', data.type);
        // 부분 데이터 수신 (향후 UI 업데이트 가능)
      },
      onResult: (data) => {
        console.log('[Medicine 스트리밍] 최종 결과:', data);
        if (data.success && data.data) {
          setAnalysisResult(data.data);
          setShowAnalysis(true);
        }
        setStreamProgress(100);
        setIsAnalyzing(false);
        setStreamingMessage('분석 완료!');
      },
      onError: (error) => {
        console.error('[Medicine 스트리밍] 오류:', error);
        
        // 에러 메시지 개선
        let userFriendlyMessage = error.message;
        if (error.message?.includes('503')) {
          userFriendlyMessage = '⚠️ AI 서비스가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message?.includes('429')) {
          userFriendlyMessage = '⚠️ AI 분석 요청이 일시적으로 제한되었습니다. 1-2분 후 다시 시도해주세요.';
        } else if (error.message?.includes('500') || error.message?.includes('502')) {
          userFriendlyMessage = '⚠️ 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (!error.message || error.message.length > 100) {
          userFriendlyMessage = '⚠️ 분석 중 오류가 발생했습니다. 다시 시도해주세요.';
        }
        
        setStreamError(userFriendlyMessage);
        setIsAnalyzing(false);
      },
      onComplete: () => {
        console.log('[Medicine 스트리밍] 완료');
        setIsAnalyzing(false);
      }
    });

    abortRef.current = abort;
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
        <div className="medicine__header-content">
          <div>
            <h1 className="medicine__title">복용 중인 약</h1>
            <p className="medicine__subtitle">내 약 {medicines.length}개</p>
          </div>
          <button 
            className="medicine__add-button"
            onClick={() => window.location.href = '/medicine/add'}
          >
            +
          </button>
        </div>
      </header>

      {/* 목록 화면 */}
      {(
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
            <div>
              {/* 📊 초기 화면: 등록 데이터 기반 간단 분석 */}
              
              {/* 약품 종합 위험도 프로파일 (등록 즉시 생성) */}
              <MedicineRadarChart medicines={medicines} />

              {/* 복용 시간표 (등록 데이터 기반) */}
              <MedicineSchedule 
                medicines={medicines} 
                onUpdateSchedule={handleUpdateSchedule} 
              />

              {/* AI 종합 분석 버튼 */}
              <div className="medicine__analyze-section">
                <button
                  className="medicine__analyze-all-btn"
                  onClick={handleAnalyzeAll}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? '🔄 분석 중...' : '🔬 AI 약물 상호작용 상세 분석'}
                </button>
                <p className="medicine__analyze-desc">
                  AI가 복용 중인 모든 약물의 상호작용을 상세 분석합니다
                </p>
                
                {/* 분석 완료 후 결과 보기 버튼 */}
                {analysisResult && !isAnalyzing && (
                  <button
                    className="medicine__view-result-btn"
                    onClick={() => setShowAnalysis(true)}
                  >
                    📋 분석 결과 보기
                  </button>
                )}
              </div>

              {/* 🆕 스트리밍 분석 진행 상황 표시 */}
              {isAnalyzing && (
                <div className="medicine__streaming-section">
                  <div className="medicine__streaming-header">
                    <div className="medicine__streaming-spinner"></div>
                    <div className="medicine__streaming-info">
                      <p className="medicine__streaming-title">약물 상호작용 분석 중</p>
                      <p className="medicine__streaming-message">{streamingMessage}</p>
                    </div>
                  </div>

                  {/* 진행 바 */}
                  <div className="medicine__streaming-progress">
                    <div className="medicine__streaming-progress-bar">
                      <div 
                        className="medicine__streaming-progress-fill" 
                        style={{ width: `${streamProgress}%` }}
                      />
                    </div>
                    <span className="medicine__streaming-progress-text">{Math.round(streamProgress)}%</span>
                  </div>

                  {/* 단계별 상태 */}
                  <div className="medicine__streaming-stages">
                    {streamingStages.map((stage) => (
                      <div 
                        key={stage.stage} 
                        className={`medicine__streaming-stage medicine__streaming-stage--${stage.status}`}
                      >
                        <span className="medicine__streaming-stage-number">{stage.stage}</span>
                        <span className="medicine__streaming-stage-name">{stage.name}</span>
                        <span className="medicine__streaming-stage-icon">
                          {stage.status === 'complete' ? '✅' : 
                           stage.status === 'loading' ? '🔄' : '⏳'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* 에러 표시 */}
                  {streamError && (
                    <div className="medicine__error-section">
                      <p className="medicine__error-message">{streamError}</p>
                      <button
                        className="medicine__retry-btn"
                        onClick={() => {
                          setStreamError(null);
                          setStreamingStages([]);
                          setStreamProgress(0);
                          handleAnalyzeAll();
                        }}
                      >
                        🔄 다시 분석하기
                      </button>
                    </div>
                  )}
                </div>
              )}

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

              {/* 약품 태그 목록 */}
              <div className="medicine__tag-list">
                {medicines.map((med) => {
                  // 약품 타입 확인 (의약품 vs 건강기능식품)
                  const medicineTypes = JSON.parse(sessionStorage.getItem('medicineTypes') || '{}');
                  const medicineType = medicineTypes[med.id] || 'medicine';
                  
                  return (
                    <div
                      key={med.id}
                      className={`medicine__tag medicine__tag--${medicineType}`}
                      onClick={() => {
                        setSelectedMedicineDetail(med);
                        setShowMedicineDetailPopup(true);
                      }}
                    >
                      <span className="medicine__tag-icon">
                        {medicineType === 'healthfood' ? '🥗' : '💊'}
                      </span>
                      <span className="medicine__tag-name">
                        {med.itemName || med.name || '약품명 미확인'}
                      </span>
                      <button
                        className="medicine__tag-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMedicine(med.id);
                        }}
                        aria-label="삭제"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* \ub0b4\uc57d \ucd94\uac00 \ud654\uba74\uc740 \ubcc4\ub3c4 \ud398\uc774\uc9c0\ub85c \ubd84\ub9ac */}
      
      {false && activeTab === 'add' && addSubTab === 'medicine' && (
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
                className="medicine__capture-btn medicine__capture-btn--primary"
                onClick={() => setShowImageSourceModal(true)}
                disabled={isAnalyzingImage}
              >
                📷 촬영하기
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

            {/* 🆕 등록 상태 표시 */}
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

      {false && activeTab === 'add' && addSubTab === 'healthfood' && (
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

            {/* 🆕 등록 상태 표시 */}
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
            <h3 className="medicine__add-title">{addProgress.medicineName || '약품'}을 추가 중입니다.</h3>
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
                      확인
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

export default Medicine;
