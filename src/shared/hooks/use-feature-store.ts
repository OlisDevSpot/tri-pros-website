import { create } from 'zustand'

interface FeatureStore {
  featureInView: string
  setFeatureInView: (featureInView: string) => void
}

export const useFeatureStore = create<FeatureStore>(set => ({
  featureInView: '',
  setFeatureInView: (featureInView: string) => set({ featureInView }),
}))
