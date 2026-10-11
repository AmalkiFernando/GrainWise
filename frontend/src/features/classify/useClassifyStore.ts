import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { MeasurementInput, Variety } from '@/lib/api'

export interface HistoryEntry {
  id: string
  at: number
  input: MeasurementInput
  variety: Variety
  probabilityCammeo: number
  threshold: number
  /** The recorded variety, when the grain was loaded unchanged from the held-out samples. */
  recorded: Variety | null
}

const HISTORY_LIMIT = 12

interface ClassifyState {
  /** Decision threshold on P(Cammeo); null until the model info says what the default is. */
  threshold: number | null
  history: HistoryEntry[]
  setThreshold: (threshold: number) => void
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'at'>) => void
  clearHistory: () => void
}

/** The chosen threshold and recent predictions, kept per browser across visits. */
export const useClassifyStore = create<ClassifyState>()(
  persist(
    (set) => ({
      threshold: null,
      history: [],
      setThreshold: (threshold) => set({ threshold }),
      addHistory: (entry) =>
        set((state) => ({
          history: [
            {
              ...entry,
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              at: Date.now(),
            },
            ...state.history,
          ].slice(0, HISTORY_LIMIT),
        })),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'grainwise.classify',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
