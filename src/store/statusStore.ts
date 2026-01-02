import { create } from "zustand";

// 캐시 유효 시간: 5분
const CACHE_TTL = 5 * 60 * 1000;

interface HistoryItem {
  id: string;
  type: string;
  name: string;
  change: number;
  date: string;
  time: string;
}

interface StatusData {
  totalLifeChangeDays: number;
  todayLifeChangeDays: number;
  initialLifeExpectancy: number;
  currentLifeExpectancy: number;
  wittyMessage: string;
}

interface StatusStore {
  statusData: StatusData | null;
  historyList: HistoryItem[];
  isLoading: boolean;
  hasMore: boolean;
  offset: number;
  lastFetchTime: number | null;

  // Actions
  setStatusData: (data: StatusData) => void;
  setHistoryList: (list: HistoryItem[]) => void;
  appendHistory: (items: HistoryItem[]) => void;
  setLoading: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setOffset: (offset: number) => void;

  // 캐시 관련
  shouldRefetch: () => boolean;
  invalidateCache: () => void;
  reset: () => void;
}

export const useStatusStore = create<StatusStore>((set, get) => ({
  statusData: null,
  historyList: [],
  isLoading: false,
  hasMore: true,
  offset: 0,
  lastFetchTime: null,

  setStatusData: (statusData) =>
    set({
      statusData,
      lastFetchTime: Date.now(),
    }),

  setHistoryList: (historyList) =>
    set({ historyList: Array.isArray(historyList) ? historyList : [] }),

  appendHistory: (items) =>
    set((state) => ({
      historyList: [...state.historyList, ...items],
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setHasMore: (hasMore) => set({ hasMore }),
  setOffset: (offset) => set({ offset }),

  // 캐시 만료 여부 확인 (true = 새로 fetch 필요)
  shouldRefetch: () => {
    const { statusData, lastFetchTime } = get();
    if (!statusData) return true;
    if (!lastFetchTime) return true;
    return Date.now() - lastFetchTime > CACHE_TTL;
  },

  // 캐시 무효화
  invalidateCache: () => set({ lastFetchTime: null }),

  // 전체 리셋
  reset: () =>
    set({
      statusData: null,
      historyList: [],
      hasMore: true,
      offset: 0,
      lastFetchTime: null,
    }),
}));
