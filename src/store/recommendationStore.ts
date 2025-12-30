import { create } from "zustand";

interface FoodContent {
  name: string;
  reason: string;
  pros: string;
  imageUrl?: string;
  relatedLink?: string;
}

interface RemedyContent {
  country: string;
  title: string;
  description: string;
  warning: string;
  flag?: string;
  relatedLink?: string;
}

interface ExerciseContent {
  name: string;
  description: string;
  intensity: string;
  imageUrl?: string;
  relatedLink?: string;
}

interface RecommendationData {
  id: string;
  date: string;
  food_content: FoodContent;
  remedy_content: RemedyContent;
  exercise_content: ExerciseContent;
}

interface RecommendationStore {
  data: RecommendationData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchDate: string | null;

  // Actions
  setData: (data: RecommendationData) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // 캐시 관련 - 오늘 데이터만 유효
  shouldRefetch: () => boolean;
  reset: () => void;
}

const getToday = () => new Date().toISOString().split("T")[0];

export const useRecommendationStore = create<RecommendationStore>(
  (set, get) => ({
    data: null,
    isLoading: false,
    error: null,
    lastFetchDate: null,

    setData: (data) =>
      set({
        data,
        lastFetchDate: getToday(),
        error: null,
      }),

    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),

    // 오늘 데이터가 없으면 fetch 필요
    shouldRefetch: () => {
      const { data, lastFetchDate } = get();
      if (!data) return true;
      if (!lastFetchDate) return true;
      return lastFetchDate !== getToday(); // 날짜가 바뀌면 새로 fetch
    },

    reset: () =>
      set({
        data: null,
        lastFetchDate: null,
        error: null,
      }),
  })
);
