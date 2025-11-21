import { create } from 'zustand';

interface Medicine {
  id: string;
  medicine_name: string;
  dosage?: string;
  frequency?: string;
  is_active: boolean;
  created_at: string;
}

interface MedicineStore {
  medicines: Medicine[];
  activeMedicines: Medicine[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setMedicines: (medicines: Medicine[]) => void;
  addMedicine: (medicine: Medicine) => void;
  updateMedicine: (id: string, updates: Partial<Medicine>) => void;
  deleteMedicine: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useMedicineStore = create<MedicineStore>((set) => ({
  medicines: [],
  activeMedicines: [],
  isLoading: false,
  error: null,

  setMedicines: (medicines) =>
    set({
      medicines,
      activeMedicines: medicines.filter((m) => m.is_active),
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
}));
