import type { OmniActionId } from '@/features/omni-search/types'

import { useCallback } from 'react'

import { useDashboardOverlays } from '@/features/agent-dashboard/hooks/use-dashboard-overlays'
import { useThemeTransition } from '@/features/agent-dashboard/hooks/use-theme-transition'
import { signOut } from '@/shared/domains/auth/client'

/** Actions that finish in one step. `schedule-meeting` is a mode, handled by the results. */
export function useOmniActions() {
  const { isDark, switchTheme } = useThemeTransition()
  const setActionCenterOpen = useDashboardOverlays(state => state.setActionCenterOpen)

  return useCallback((action: Exclude<OmniActionId, 'schedule-meeting'>) => {
    switch (action) {
      case 'toggle-theme':
        switchTheme(isDark ? 'light' : 'dark', null)
        return
      case 'action-center':
        setActionCenterOpen(true)
        return
      case 'sign-out':
        void signOut({ fetchOptions: { onSuccess: () => window.location.assign('/') } })
    }
  }, [isDark, switchTheme, setActionCenterOpen])
}
