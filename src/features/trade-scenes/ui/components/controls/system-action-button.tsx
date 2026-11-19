import type { SystemAction } from '@/features/trade-scenes/lib/system-actions'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { SYSTEM_ACTION_ICONS } from '@/features/trade-scenes/constants/scene-control-icons'

interface SystemActionButtonProps {
  action: SystemAction
}

// The draw buttons and Look inside carry the marks the Escape steps look for to put focus back.
export function SystemActionButton({ action }: SystemActionButtonProps) {
  const Icon = SYSTEM_ACTION_ICONS[action.id]
  const marks = {
    'data-look-inside': action.id === 'look-inside' ? '' : undefined,
    'data-yard-draw': action.id === 'draw-region' ? 'ground' : action.id === 'draw-fence' ? 'fence' : undefined,
  }
  return (
    <button type="button" aria-pressed={action.pressed ?? undefined} onClick={action.run} className={CONTROLS_CLASSES.actionButton} {...marks}>
      <Icon aria-hidden />
      {action.label}
    </button>
  )
}
