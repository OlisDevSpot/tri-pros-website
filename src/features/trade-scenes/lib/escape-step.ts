import type { ControlsSection, SystemsFocus } from '@/features/trade-scenes/types'

interface EscapeContext {
  // A value menu is open; its popover closes on the key itself.
  menu: boolean
  lookInside: boolean
  focus: SystemsFocus
  open: ControlsSection | null
  // The systems at a tapped spot are pinned.
  pins: boolean
}

// One layer a press, the innermost first. A window owns its own Escape, so with one open nothing here steps back; the
// pins at a spot only count over the bare scene.
export function escapeStep({ menu, lookInside, focus, open, pins }: EscapeContext): 'menu' | 'look-inside' | 'focus' | 'systems' | 'pins' | null {
  if (menu) {
    return 'menu'
  }
  if (lookInside) {
    return 'look-inside'
  }
  if (open === 'systems') {
    return focus === null ? 'systems' : 'focus'
  }
  return open === null && pins ? 'pins' : null
}
