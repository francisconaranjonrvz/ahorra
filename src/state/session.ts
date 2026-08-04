import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

const HOUSEHOLD_ID_KEY = 'ahorra-household-id';

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
  setHouseholdId: (householdId) => {
    set({ householdId });
    if (householdId) {
      void AsyncStorage.setItem(HOUSEHOLD_ID_KEY, householdId);
    } else {
      void AsyncStorage.removeItem(HOUSEHOLD_ID_KEY);
    }
  },
  setLoading: (isLoading) => set({ isLoading }),
}));

/**
 * Restaura el household activo guardado en el dispositivo. Se llama una vez al
 * arrancar la app (ver app/_layout.tsx) — sin esto, cada reinicio vuelve a "sin
 * household" aunque el usuario ya tenga uno, aunque siga con sesión iniciada.
 * No usa zustand/persist: ese middleware se cuelga en el bundle web (falla el
 * require perezoso del subpath), y para un único string no hace falta.
 */
export async function restoreHouseholdId(): Promise<void> {
  const stored = await AsyncStorage.getItem(HOUSEHOLD_ID_KEY);
  if (stored) useSessionStore.getState().setHouseholdId(stored);
}
