import { create } from 'zustand';

interface RewardItem {
  id: string;
  name: string;
  brand: string;
  point_cost: number;
  description: string;
  image_url: string;
  is_available: boolean;
}

interface PointHistory {
  id: string;
  type: 'earn' | 'spend' | 'expire';
  points: number;
  reason?: string;
  reward_name?: string;
  balance_after: number;
  created_at: string;
}

interface RewardStore {
  currentPoints: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  rewardItems: RewardItem[];
  pointHistory: PointHistory[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setPoints: (points: { currentPoints: number; lifetimeEarned: number; lifetimeSpent: number }) => void;
  setRewardItems: (items: RewardItem[]) => void;
  setPointHistory: (history: PointHistory[]) => void;
  claimReward: (itemId: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useRewardStore = create<RewardStore>((set) => ({
  currentPoints: 0,
  lifetimeEarned: 0,
  lifetimeSpent: 0,
  rewardItems: [],
  pointHistory: [],
  isLoading: false,
  error: null,

  setPoints: ({ currentPoints, lifetimeEarned, lifetimeSpent }) =>
    set({ currentPoints, lifetimeEarned, lifetimeSpent }),

  setRewardItems: (rewardItems) => set({ rewardItems }),

  setPointHistory: (pointHistory) => set({ pointHistory }),

  claimReward: async (itemId: string) => {
    // API 호출 로직은 컴포넌트에서 처리
    set({ isLoading: true });
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
