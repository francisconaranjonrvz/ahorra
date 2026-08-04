import { create } from 'zustand';

import { startOfMonthCivil, todayInMadrid, type CivilDate } from '@/domain/civil-date';

interface UiState {
  selectedMonth: CivilDate; // primer día del mes, YYYY-MM-01
  setSelectedMonth: (month: CivilDate) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedMonth: startOfMonthCivil(todayInMadrid()),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
}));
