import type { ControlsSection, SystemsPick } from '@/features/trade-scenes/types'

interface EscapeContext {
  // A value menu is open; its popover closes on the key itself.
  menu: boolean
  // The lot is being drawn on: the camera is held still until drawing ends.
  drawing: boolean
  lookInside: boolean
  picked: SystemsPick
  open: ControlsSection | null
  // A spot chip stands at a tapped spot, in quick edit or not, and its Paint wear / Roof wear fold is open or shut.
  spotChip: boolean
  editing: boolean
  fold: boolean
  // On the Lot group: a yard is held, and a thing in it is selected.
  yard: boolean
  thing: boolean
}

// One layer a press, the innermost first. A window owns its own Escape, so with one open nothing here steps back; the
// spot chip's layers count over the bare scene and over the Systems section, ahead of its card, and a chip and up close never stand together.
export function escapeStep({ menu, drawing, lookInside, picked, open, spotChip, editing, fold, yard, thing }: EscapeContext): 'menu' | 'drawing' | 'fold' | 'quick-edit' | 'spot-chip' | 'look-inside' | 'thing' | 'yard' | 'card' | 'systems' | null {
  if (menu) {
    return 'menu'
  }
  if (drawing) {
    return 'drawing'
  }
  if ((open === null || open === 'systems') && spotChip) {
    return fold ? 'fold' : editing ? 'quick-edit' : 'spot-chip'
  }
  if (lookInside) {
    return 'look-inside'
  }
  if (open === 'systems') {
    if (thing) {
      return 'thing'
    }
    if (yard) {
      return 'yard'
    }
    return picked === null ? 'systems' : 'card'
  }
  return null
}
