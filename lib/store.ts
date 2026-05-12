import { create } from 'zustand'

interface AppState {
  sidebarExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void
  notifications: number
  aiCopilotOpen: boolean
  setAiCopilotOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarExpanded: true,
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
  notifications: 3,
  aiCopilotOpen: false,
  setAiCopilotOpen: (open) => set({ aiCopilotOpen: open }),
}))
