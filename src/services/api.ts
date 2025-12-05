import axios from 'axios';
import { getDeviceId } from '../utils/deviceId';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 모든 요청에 Device ID 헤더 추가
apiClient.interceptors.request.use((config) => {
  const deviceId = getDeviceId();
  config.headers['X-Device-Id'] = deviceId;
  console.log('[API Request]', config.method?.toUpperCase(), config.url, '| Device ID:', deviceId);
  return config;
});

// ============================================
// 사용자/기기 관리 API
// ============================================

// 기기 등록 또는 조회 (첫 접속 시 자동 호출)
export const registerDevice = async () => {
  const deviceId = getDeviceId();
  const response = await apiClient.post('/users/register-device', { deviceId });
  return response.data;
};

// 현재 기기의 사용자 정보 조회
export const getCurrentUser = async () => {
  const response = await apiClient.get('/users/me');
  return response.data;
};

// 사용자 프로필 업데이트 (닉네임 등)
export const updateUserProfile = async (profile: { nickname?: string; diseases?: string[] }) => {
  const response = await apiClient.patch('/users/me', profile);
  return response.data;
};

// 분석 히스토리 조회
export const getAnalysisHistory = async (limit: number = 20, offset: number = 0) => {
  const response = await apiClient.get('/users/history', {
    params: { limit, offset },
  });
  return response.data;
};

// 사용자 약물 기록 조회
export const getUserMedicines = async (activeOnly: boolean = true) => {
  const response = await apiClient.get('/users/medicines', {
    params: { activeOnly },
  });
  return response.data;
};

// ============================================
// 음식 분석 API
// ============================================

// 전체 분석 (이미지 포함, 공공데이터 포함) - 자세히 보기용
export const analyzeFoodWithImage = async (foodName: string, imageFile: File) => {
  const savedDiseases = localStorage.getItem('selectedDiseases');
  const diseases = savedDiseases ? JSON.parse(savedDiseases) : [];

  const formData = new FormData();
  formData.append('foodName', foodName);
  formData.append('image', imageFile);
  formData.append('diseases', JSON.stringify(diseases));

  const response = await apiClient.post('/food/analyze', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  console.log('API 응답 (analyzeFoodWithImage):', response.data);
  return response.data;
};

// 전체 분석 (텍스트만, 공공데이터 포함) - 자세히 보기용
export const analyzeFoodByText = async (foodName: string) => {
  const savedDiseases = localStorage.getItem('selectedDiseases');
  const diseases = savedDiseases ? JSON.parse(savedDiseases) : [];

  const response = await apiClient.post('/food/text-analyze', { 
    foodName,
    diseases 
  });
  
  console.log('API 응답 (analyzeFoodByText):', response.data);
  return response.data;
};

// 빠른 AI 분석 (텍스트만, 공공데이터 없음) - Result01용
export const simpleAnalyzeFoodByText = async (foodName: string) => {
  const savedDiseases = localStorage.getItem('selectedDiseases');
  const diseases = savedDiseases ? JSON.parse(savedDiseases) : [];
  const response = await apiClient.post('/food/simple-text-analyze', { foodName, diseases });
  console.log('API 응답 (simpleAnalyzeFoodByText):', response.data);
  return response.data;
};

// 빠른 AI 분석 (이미지 포함, 공공데이터 없음) - Result01용
export const simpleAnalyzeFoodWithImage = async (foodName: string, imageFile: File) => {
  const savedDiseases = localStorage.getItem('selectedDiseases');
  const diseases = savedDiseases ? JSON.parse(savedDiseases) : [];

  const formData = new FormData();
  formData.append('foodName', foodName);
  formData.append('image', imageFile);
  formData.append('diseases', JSON.stringify(diseases));

  const response = await apiClient.post('/food/simple-analyze', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  console.log('API 응답 (simpleAnalyzeFoodWithImage):', response.data);
  return response.data;
};

// 음식 분석 결과 조회
export const getFoodAnalysis = async (id: string) => {
  const response = await apiClient.get(`/food/${id}`);
  return response.data;
};

// ============================================
// 약 관리 API
// ============================================

// QR 코드 스캔
export const scanMedicineQR = async (qrData: string, dosage?: string, frequency?: string) => {
  const response = await apiClient.post('/medicine/scan-qr', {
    qrData,
    dosage,
    frequency,
  });
  return response.data;
};

// 약품 검색 (일반/전문 의약품)
export const searchMedicine = async (keyword: string, limit?: number) => {
  console.log('[API] searchMedicine 호출:', { keyword, limit });
  try {
    const response = await apiClient.post('/medicine/search', { keyword, ...(limit && { limit }) });
    console.log('[API] searchMedicine 응답:', response);
    console.log('[API] searchMedicine 데이터:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] searchMedicine 에러:', error);
    throw error;
  }
};

// 건강기능식품 전용 검색
export const searchHealthFood = async (keyword: string, limit?: number) => {
  console.log('[API] searchHealthFood 호출:', { keyword, limit });
  try {
    const response = await apiClient.post('/medicine/search-health-food', { keyword, ...(limit && { limit }) });
    console.log('[API] searchHealthFood 응답:', response);
    console.log('[API] searchHealthFood 데이터:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] searchHealthFood 에러:', error);
    throw error;
  }
};

// 내 약 목록 조회
// @param includeAnalysis - true면 AI 분석 결과도 함께 반환
export const getMyMedicines = async (activeOnly: boolean = true, includeAnalysis: boolean = false) => {
  const response = await apiClient.get('/medicine/my-list', {
    params: { active: activeOnly, includeAnalysis: includeAnalysis ? 'true' : undefined },
  });
  return response.data;
};

// 약-음식 상호작용 분석
export const analyzeMedicineInteraction = async (medicineIds: string[], foodName: string) => {
  const response = await apiClient.post('/medicine/analyze-interaction', {
    medicineIds,
    foodName,
  });
  return response.data;
};

// 약 기록 수정
export const updateMedicine = async (id: string, updates: any) => {
  const response = await apiClient.patch(`/medicine/${id}`, updates);
  return response.data;
};

// 약 기록 삭제
export const deleteMedicine = async (id: string) => {
  const response = await apiClient.delete(`/medicine/${id}`);
  return response.data;
};

// 검색한 약 직접 추가
export const addMedicine = async (medicineData: {
  itemName: string;
  entpName: string;
  itemSeq?: string;
  efcyQesitm?: string;
  dosage?: string;
  frequency?: string;
}) => {
  const response = await apiClient.post('/medicine/add', medicineData);
  return response.data;
};

// 복용 중인 모든 약물 상관관계 종합 분석
export const analyzeAllMedicines = async () => {
  const response = await apiClient.post('/medicine/analyze-all');
  return response.data;
};

// 📸 약품 이미지 분석 (AI 기반)
// 약 봉지, 처방전, 알약 촬영하여 약품명 인식
export const analyzeMedicineImage = async (imageBase64: string, mimeType: string = 'image/jpeg') => {
  console.log('[API] analyzeMedicineImage 호출');
  try {
    const response = await apiClient.post('/medicine/analyze-image', { 
      imageBase64, 
      mimeType 
    });
    console.log('[API] analyzeMedicineImage 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] analyzeMedicineImage 에러:', error);
    throw error;
  }
};

// ============================================
// 리워드 API
// ============================================

// 포인트 조회
export const getRewardPoints = async () => {
  const response = await apiClient.get('/reward/points');
  return response.data;
};

// 교환 가능 상품 목록
export const getRewardItems = async () => {
  const response = await apiClient.get('/reward/items');
  return response.data;
};

// 리워드 교환
export const claimReward = async (rewardId: string) => {
  const response = await apiClient.post('/reward/claim', { rewardId });
  return response.data;
};

// 포인트 내역
export const getRewardHistory = async (type?: string, limit: number = 50, offset: number = 0) => {
  const response = await apiClient.get('/reward/history', {
    params: { type, limit, offset },
  });
  return response.data;
};

// ============================================
// 통계 API
// ============================================

// 일별 점수 조회
export const getDailyScore = async (date?: string) => {
  const response = await apiClient.get('/stats/daily', {
    params: { date },
  });
  return response.data;
};

// 월별 통계 조회
export const getMonthlyReport = async (year?: number, month?: number) => {
  const response = await apiClient.get('/stats/monthly', {
    params: { year, month },
  });
  return response.data;
};

// 전체 요약 통계
export const getStatsSummary = async () => {
  const response = await apiClient.get('/stats/summary');
  return response.data;
};

// 일별 점수 재계산
export const calculateDailyScore = async (date?: string) => {
  const response = await apiClient.post('/stats/calculate-daily', null, {
    params: { date },
  });
  return response.data;
};

// ============================================
// AI 종합 분석 API (신규)
// ============================================

// 음식+약+영양제 종합 분석
export const analyzeCombined = async (data: {
  foodName: string;
  medicines?: string[];
  supplements?: string[];
  diseases: string[];
  imageUrl?: string;
}) => {
  const response = await apiClient.post('/ai/analyze-combined', data);
  return response.data;
};

// ============================================
// 🆕 스트리밍 분석 API (SSE)
// ============================================

export interface StreamingCallbacks {
  onStart?: (data: { foodName: string; message: string; stages: string[] }) => void;
  onStage?: (data: { stage: number; name: string; status: string; message: string; data?: any }) => void;
  onPartial?: (data: { type: string; data: any }) => void;
  onResult?: (data: { success: boolean; data: any }) => void;
  onError?: (error: { message: string }) => void;
  onComplete?: () => void;
}

// 스트리밍 분석 (SSE) - Result02용
export const analyzeFoodByTextStream = (
  foodName: string,
  callbacks: StreamingCallbacks
): { abort: () => void } => {
  console.log('[analyzeFoodByTextStream] 함수 호출됨');
  console.log('[analyzeFoodByTextStream] foodName:', foodName);
  
  const savedDiseases = localStorage.getItem('selectedDiseases');
  const diseases = savedDiseases ? JSON.parse(savedDiseases) : [];
  const deviceId = getDeviceId();

  console.log('[analyzeFoodByTextStream] diseases:', diseases);
  console.log('[analyzeFoodByTextStream] deviceId:', deviceId);

  const abortController = new AbortController();

  console.log('[SSE] 스트리밍 분석 요청:', { foodName, diseases, deviceId });
  console.log('[SSE] fetch 요청 시작:', `${API_BASE_URL}/food/text-analyze-stream`);

  // fetch로 SSE 연결
  fetch(`${API_BASE_URL}/food/text-analyze-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId,
    },
    body: JSON.stringify({ foodName, diseases }),
    signal: abortController.signal,
  })
    .then(async (response) => {
      console.log('[SSE] Response status:', response.status, response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SSE] HTTP 오류 응답:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('[SSE] 연결 성공, 스트림 시작');

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      
      // 이벤트 상태를 루프 내에서 유지
      let currentEvent = '';
      let currentData = '';

      const processEvent = () => {
        if (currentEvent && currentData) {
          try {
            console.log(`[SSE] Raw event: "${currentEvent}", data: "${currentData.substring(0, 100)}..."`);
            const parsedData = JSON.parse(currentData);
            console.log(`[SSE] 이벤트 수신: ${currentEvent}`, parsedData);
            
            switch (currentEvent) {
              case 'start':
                callbacks.onStart?.(parsedData);
                break;
              case 'stage':
                callbacks.onStage?.(parsedData);
                break;
              case 'partial':
                callbacks.onPartial?.(parsedData);
                break;
              case 'result':
                callbacks.onResult?.(parsedData);
                break;
              case 'error':
                callbacks.onError?.(parsedData);
                break;
              case 'complete':
                callbacks.onComplete?.();
                break;
            }
          } catch (e) {
            console.warn('[SSE] 데이터 파싱 실패:', currentData, e);
          }
          currentEvent = '';
          currentData = '';
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // 남은 이벤트 처리
          processEvent();
          console.log('[SSE] 스트림 종료');
          callbacks.onComplete?.();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log('[SSE] 청크 수신:', chunk.length, 'bytes');
        
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          console.log('[SSE] 라인:', line);
          
          if (line.startsWith('event:')) {
            // 새 이벤트 시작 전 이전 이벤트 처리
            processEvent();
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            currentData = line.slice(5).trim();
          } else if (line === '') {
            // 빈 줄은 SSE 메시지 구분자 - 이벤트 처리
            processEvent();
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        console.error('[SSE] 연결 오류:', error);
        callbacks.onError?.({ message: error.message });
      }
    });

  return {
    abort: () => abortController.abort(),
  };
};

export default apiClient;
