import type { PanelSection } from '@/features/meeting-flow/types'

/** DOM id of the inspector panel; `aria-controls` target for the hamburger and rail buttons. */
export const PANEL_ID = 'meeting-panel'

export const PANEL_SECTIONS: PanelSection[] = ['meeting', 'context', 'persona']

/** Section the hamburger opens the first time. */
export const DEFAULT_PANEL_SECTION: PanelSection = 'meeting'
