import type { CSSProperties } from 'react'
import type { OmniEntryGroup, OmniItemLayout, OmniStackRecord, OmniStatusKind } from '@/features/omni-search/types'

import { FileTextIcon, HandshakeIcon, ImageIcon, UsersRoundIcon } from 'lucide-react'

import { BREAKPOINTS } from '@/shared/constants/css-breakpoints'
import { OMNI_LIMITS } from '@/shared/domains/omni-search/schemas'

export const OMNI_DEBOUNCE_MS = 150
export const OMNI_STALE_MS = 30_000
/** Shorter than this (a phone on its side) leaves too little room above the keyboard for stacks, so the phone list shows. */
export const OMNI_DESKTOP_MIN_HEIGHT = 500
export const OMNI_DESKTOP_QUERY = `(min-width: ${BREAKPOINTS.sm}px) and (min-height: ${OMNI_DESKTOP_MIN_HEIGHT}px)`
export const OMNI_ENTRY_CAPS: Record<OmniEntryGroup, number> = { 'go-to': 5, 'actions': 4 }
/** Records under each of the top customers on desktop: one stack per related customer, the first as deep as the server's per-customer cap. */
export const OMNI_STACK_CAPS = [OMNI_LIMITS.related, 2, 2] as const satisfies { length: typeof OMNI_LIMITS.relatedCustomers }
/** A stack takes one record of each kind at a time, in this order, then shows them grouped in it. */
export const OMNI_STACK_KIND_ORDER = ['meeting', 'proposal', 'project'] as const satisfies readonly OmniStackRecord['kind'][]
/** The record kinds a customer's count chips show, in this order. */
export const OMNI_COUNT_KINDS = ['meeting', 'proposal', 'project'] as const
/** Rows per kind in the phone list. */
export const OMNI_LIST_KIND_CAP = OMNI_LIMITS.related
export const OMNI_SKELETON_ROWS = [0, 1, 2] as const

// Same icons as the sidebar's records group, so a result reads as the page it belongs to.
export const OMNI_RECORD_ICONS = {
  customer: UsersRoundIcon,
  meeting: HandshakeIcon,
  proposal: FileTextIcon,
  project: ImageIcon,
} as const

// The dialog zeroes cmdk items' vertical padding, so each recipe sets its own height. 44px rows on a coarse pointer.
export const OMNI_ROW_CLASSES: Record<OmniItemLayout, string> = {
  line: 'min-h-14 gap-3 rounded-lg',
  nested: 'h-9 gap-2.5 rounded-md pointer-coarse:h-11',
  compact: 'h-10 gap-2.5 rounded-md pointer-coarse:h-11',
}
// A customer row and its capsule sit side by side, so the capsule's buttons are never inside the option; the
// wrapper paints the highlight across both.
export const OMNI_CONTACT_ROW_CLASS = 'flex items-center has-[[cmdk-item][data-selected=true]]:bg-row-hover'
export const OMNI_ICON_TILE_CLASS = 'grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4'
export const OMNI_KIND_LABEL_CLASS = 'w-16 shrink-0 text-xs font-medium text-muted-foreground'

export const OMNI_STATUS_DOT_CLASSES: Record<OmniStatusKind, string> = {
  idle: 'bg-status-idle-dot',
  busy: 'bg-primary motion-safe:animate-pulse',
  done: 'bg-status-success-dot',
  none: 'bg-status-idle-dot',
  error: 'bg-status-danger-dot',
}

// No backdrop blur: at 84-86% opacity the glass showed no visible frost, and the filter cost ~40 ms per keystroke.
// Inline so the reduced-transparency !important fallback in OMNI_PANEL_CLASS is the only thing that overrides it.
export const OMNI_PANEL_STYLE = {
  backgroundColor: 'var(--palette-glass)',
  backgroundImage: 'var(--popover-glass-overlay)',
  boxShadow: 'var(--popover-glass-shadow)',
} as const satisfies CSSProperties

// Top-anchored at every size, so the panel never jumps as results change height and stays above a keyboard;
// --omni-vvh (the visual viewport's height, set while open) bounds it there. Tailwind needs literal classes, so
// OMNI_DESKTOP_QUERY's condition is spelled out again in the [@media…] variants: change both together. The
// !important fallback beats the inline glass for viewers who ask for less transparency.
export const OMNI_PANEL_CLASS = [
  'surface-palette flex flex-col gap-0 rounded-xl border-0 ease-(--ease-brand)',
  'data-[state=closed]:zoom-out-98! data-[state=open]:zoom-in-98! motion-reduce:data-[state=closed]:zoom-out-100! motion-reduce:data-[state=open]:zoom-in-100!',
  'top-[calc(env(safe-area-inset-top)_+_0.5rem)] translate-y-0 max-w-[calc(100%-1rem)] sm:max-w-180',
  'max-h-[min(calc(var(--omni-vvh,100dvh)_-_env(safe-area-inset-top)_-_1rem),30rem)]',
  '[@media(min-width:640px)_and_(min-height:500px)]:top-[12vh] [@media(min-width:640px)_and_(min-height:500px)]:max-h-[calc(var(--omni-vvh,100dvh)_-_12vh_-_1rem)]',
  '[@media(prefers-reduced-transparency:reduce)]:bg-popover! [@media(prefers-reduced-transparency:reduce)]:bg-none!',
].join(' ')
/** The list flexes inside the bounded panel; desktop also caps it, as the stacks are judged at that height. */
export const OMNI_LIST_CLASS = 'max-h-none min-h-0 flex-auto scroll-py-2 py-1 [@media(min-width:640px)_and_(min-height:500px)]:max-h-[min(60vh,30rem)]'
