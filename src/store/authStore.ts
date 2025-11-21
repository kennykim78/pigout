import { create } from 'zustand';

interface UserProfile {
  id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  diseases: string[];
  current_points: number;
}

interface AuthStore {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: UserProfile | null) => void;
  updateDiseases: (diseases: string[]) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  updateDiseases: (diseases) =>
    set((state) => ({
      user: state.user ? { ...state.user, diseases } : null,
    })),

  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
    }),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
