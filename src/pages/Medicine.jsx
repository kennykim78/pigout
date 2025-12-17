import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
      console.log('🔍 [Medicine] 약 목록:', {
        count: data?.length || 0,
        medicines: data?.map((med, idx) => ({
          idx,
          itemName: med.itemName,
          entpName: med.entpName,
          itemSeq: med.itemSeq,
          hasEfcyQesitm: !!med.efcyQesitm,
          hasDetails: !!(med.useMethodQesitm || med.atpnWarnQesitm || med.intrcQesitm),
        }))
      });
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

      console.log('🔍 [Medicine] 약 추가 요청:', {
        itemName: medicine.itemName,
        entpName: medicine.entpName,
        itemSeq: medicine.itemSeq,
        hasEfcyQesitm: !!medicine.efcyQesitm,
        hasUseMethod: !!medicine.useMethodQesitm,
        hasAtpnWarn: !!medicine.atpnWarnQesitm,
        hasIntrc: !!medicine.intrcQesitm,
        hasSeQesitm: !!medicine.seQesitm,
        hasDepositMethod: !!medicine.depositMethodQesitm,
        isHealthFood: isHealthFood,
      });

      const result = await addMedicineAPI({
        itemName: medicine.itemName,
        entpName: medicine.entpName,
        itemSeq: medicine.itemSeq,
        efcyQesitm: medicine.efcyQesitm,
        useMethodQesitm: medicine.useMethodQesitm,
        atpnWarnQesitm: medicine.atpnWarnQesitm,
        intrcQesitm: medicine.intrcQesitm,
        seQesitm: medicine.seQesitm,
        depositMethodQesitm: medicine.depositMethodQesitm,
        isHealthFood: isHealthFood, // 🆕 의약품/건강기능식품 구분 정보 전달
      });

      console.log('✅ [Medicine] 약 추가 성공:', result);

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
        
        // 진행률 계산 (5단계 기준)
        const totalStages = 5;
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
      {/* 심플한 헤더 - Main 스타일 */}
      <div className="medicine__header">
        <div className="medicine__header-content">
          <h1 className="medicine__title">내 약 관리</h1>
          <p className="medicine__medicine-count">{medicines.length}개 등록</p>
        </div>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className="medicine__content">
        {/* 탭 버튼 - Main 스타일의 큰 버튼 */}
        <div className="medicine__tabs">
          <button
            className={`medicine__tab ${activeTab === 'list' ? 'medicine__tab--active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            <span className="material-symbols-rounded">list_alt</span>
            <span>내 약 목록</span>
          </button>
          <button
            className={`medicine__tab ${activeTab === 'add' ? 'medicine__tab--active' : ''}`}
            onClick={() => navigate('/medicine/add')}
          >
            <span className="material-symbols-rounded">add_circle</span>
            <span>약 추가</span>
          </button>
        </div>

        {/* 리스트 내용 */}
        <div className="medicine__list">
          {isLoading ? (
            <p className="medicine__loading">로딩 중...</p>
          ) : medicines.length === 0 ? (
            <div className="medicine__empty">
              <p>등록된 약이 없습니다.<br />약 추가 버튼을 눌러 약을 등록해보세요!</p>
              <button onClick={() => navigate('/medicine/add')} className="medicine__add-btn">
                약 추가하기
              </button>
            </div>
          ) : (
            <div>
              
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
                  {isAnalyzing ? '🔄 분석 중...' : analysisResult ? '🔬 상세분석 다시보기' : '🔬 AI 약물 상호작용 상세 분석'}
                </button>
                <p className="medicine__analyze-desc">
                  {analysisResult 
                    ? '분석 결과를 다시 확인하거나 업데이트할 수 있습니다' 
                    : 'AI가 복용 중인 모든 약물의 상호작용을 상세 분석합니다'}
                </p>
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
      </div>}

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
