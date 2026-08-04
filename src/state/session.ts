import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

interface SessionState {
  session: Session | null;
  householdId: string | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setHouseholdId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  householdId: null,
  isLoading: true,
  setSession: (session) => set({ session }),
  setHouseholdId: (householdId) => set({ householdId }),
  setLoading: (isLoading) => set({ isLoading }),
}));
