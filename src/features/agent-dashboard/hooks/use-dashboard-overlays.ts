import { create } from 'zustand'

interface DashboardOverlays {
  searchOpen: boolean
  actionCenterOpen: boolean
  setSearchOpen: (open: boolean) => void
  toggleSearch: () => void
  setActionCenterOpen: (open: boolean) => void
}

// The sidebar, the phone dock, ⌘K and the palette's own actions all open these, so the state lives above every one of them.
export const useDashboardOverlays = create<DashboardOverlays>()(set => ({
  searchOpen: false,
  actionCenterOpen: false,
  setSearchOpen: open => set({ searchOpen: open }),
  toggleSearch: () => set(state => ({ searchOpen: !state.searchOpen })),
  setActionCenterOpen: open => set({ actionCenterOpen: open }),
}))
