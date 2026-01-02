import { create } from "zustand";

interface DetailedAnalysis {
  goodPoints?: string[];
  badPoints?: string[];
  pros?: string[];
  cons?: string[];
  nutrition?: Record<string, number>;
  riskFactors?: Record<string, boolean>;
  medicalAnalysis?: {
    drug_food_interactions?: Array<{
      medicine_name: string;
      risk_level: string;
      interaction: string;
      recommendation: string;
    }>;
  };
  recipe?: {
    title: string;
    description: string;
    videoId?: string;
  };
  alternatives?: Array<{
    name: string;
    reason: string;
  }>;
  summary?: string;
  expertAdvice?: string;
  servingSize?: {
    amount: number;
    unit: string;
  };
  [key: string]: unknown;
}

interface CacheEntry {
  data: DetailedAnalysis;
  timestamp: number;
  userHash: string; // 사용자 프로필 + 질병 해시
}

// 캐시 유효 시간: 30분 (분석 결과는 자주 변하지 않음)
const CACHE_TTL = 30 * 60 * 1000;

interface AnalysisStore {
  cache: Record<string, CacheEntry>;

  // Actions
  getAnalysis: (foodName: string, userHash: string) => DetailedAnalysis | null;
  setAnalysis: (
    foodName: string,
    data: DetailedAnalysis,
    userHash: string
  ) => void;
  invalidateCache: (foodName?: string) => void;
  clearAllCache: () => void;
}

// 사용자 프로필 해시 생성 헬퍼
export const createUserHash = (
  age?: number,
  gender?: string,
  diseases?: string[]
): string => {
  const parts = [
    age?.toString() || "0",
    gender || "unknown",
    ...(diseases || []).sort(),
  ];
  return parts.join("-");
};

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  cache: {},

  getAnalysis: (foodName, userHash) => {
    const { cache } = get();
    const key = `${foodName.toLowerCase().trim()}`;
    const entry = cache[key];

    if (!entry) return null;

    // 캐시 만료 체크
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      // 만료된 캐시 삭제
      set((state) => {
        const newCache = { ...state.cache };
        delete newCache[key];
        return { cache: newCache };
      });
      return null;
    }

    // 사용자 해시가 다르면 캐시 무효 (다른 사용자/질병 조합)
    if (entry.userHash !== userHash) {
      return null;
    }

    console.log(`[AnalysisStore] 캐시 히트: ${foodName}`);
    return entry.data;
  },

  setAnalysis: (foodName, data, userHash) => {
    const key = `${foodName.toLowerCase().trim()}`;
    console.log(`[AnalysisStore] 캐시 저장: ${foodName}`);

    set((state) => ({
      cache: {
        ...state.cache,
        [key]: {
          data,
          timestamp: Date.now(),
          userHash,
        },
      },
    }));
  },

  // 특정 음식 캐시 무효화 (또는 전체)
  invalidateCache: (foodName) => {
    if (foodName) {
      const key = `${foodName.toLowerCase().trim()}`;
      set((state) => {
        const newCache = { ...state.cache };
        delete newCache[key];
        return { cache: newCache };
      });
    } else {
      set({ cache: {} });
    }
  },

  // 전체 캐시 삭제 (로그아웃 시 등)
  clearAllCache: () => set({ cache: {} }),
}));
