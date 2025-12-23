import { create } from "zustand";

interface Medicine {
  id: string;
  medicine_name: string;
  dosage?: string;
  frequency?: string;
  is_active: boolean;
  created_at: string;
}

// 캐시 유효 시간: 10분
const CACHE_TTL = 10 * 60 * 1000;

interface MedicineStore {
  medicines: Medicine[];
  activeMedicines: Medicine[];
  isLoading: boolean;
  error: string | null;
  lastFetchTime: number | null;

  // Actions
  setMedicines: (medicines: Medicine[]) => void;
  addMedicine: (medicine: Medicine) => void;
  updateMedicine: (id: string, updates: Partial<Medicine>) => void;
  deleteMedicine: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // 캐시 관련
  shouldRefetch: () => boolean;
  invalidateCache: () => void;
}

export const useMedicineStore = create<MedicineStore>((set, get) => ({
  medicines: [],
  activeMedicines: [],
  isLoading: false,
  error: null,
  lastFetchTime: null,

  setMedicines: (medicines) =>
    set({
      medicines,
      activeMedicines: medicines.filter((m) => m.is_active),
      lastFetchTime: Date.now(),
    }),

  addMedicine: (medicine) =>
    set((state) => ({
      medicines: [medicine, ...state.medicines],
      activeMedicines: medicine.is_active
        ? [medicine, ...state.activeMedicines]
        : state.activeMedicines,
    })),

  updateMedicine: (id, updates) =>
    set((state) => {
      const updated = state.medicines.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      );
      return {
        medicines: updated,
        activeMedicines: updated.filter((m) => m.is_active),
      };
    }),

  deleteMedicine: (id) =>
    set((state) => ({
      medicines: state.medicines.filter((m) => m.id !== id),
      activeMedicines: state.activeMedicines.filter((m) => m.id !== id),
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // 캐시 만료 여부 확인 (true = 새로 fetch 필요)
  shouldRefetch: () => {
    const { medicines, lastFetchTime } = get();
    if (medicines.length === 0) return true;
    if (!lastFetchTime) return true;
    return Date.now() - lastFetchTime > CACHE_TTL;
  },

  // 캐시 무효화 (약 추가/삭제 시 호출)
  invalidateCache: () => set({ lastFetchTime: null }),
}));
