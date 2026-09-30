export type StatusTone = 'info' | 'pending' | 'attention' | 'action' | 'success' | 'danger' | 'idle'

// Stage objects keep their palette-named `color` keys; this is the one place a key becomes a meaning.
// `indigo` and `cyan` are unused by today's pipelines but stay mapped so a new stage cannot render unstyled.
export const STAGE_COLOR_TONE: Record<string, StatusTone> = {
  blue: 'info',
  indigo: 'info',
  yellow: 'pending',
  orange: 'attention',
  purple: 'action',
  cyan: 'action',
  green: 'success',
  red: 'danger',
  slate: 'idle',
  muted: 'idle',
}

export function stageTone(color: string): StatusTone {
  return STAGE_COLOR_TONE[color] ?? 'idle'
}

export interface ToneClasses {
  text: string
  fill: string
  dot: string
  border: string
  bar: string
  wash: string
}

// Whole class strings, never assembled from pieces, so Tailwind's scanner emits every one.
export const TONE_CLASSES: Record<StatusTone, ToneClasses> = {
  info: { text: 'text-status-info-fg', fill: 'bg-status-info-bg text-status-info-fg', dot: 'bg-status-info-dot', border: 'border-status-info-dot/40', bar: 'border-t-status-info-dot', wash: 'bg-status-info-bg/70' },
  pending: { text: 'text-status-pending-fg', fill: 'bg-status-pending-bg text-status-pending-fg', dot: 'bg-status-pending-dot', border: 'border-status-pending-dot/40', bar: 'border-t-status-pending-dot', wash: 'bg-status-pending-bg/70' },
  attention: { text: 'text-status-attention-fg', fill: 'bg-status-attention-bg text-status-attention-fg', dot: 'bg-status-attention-dot', border: 'border-status-attention-dot/40', bar: 'border-t-status-attention-dot', wash: 'bg-status-attention-bg/70' },
  action: { text: 'text-status-action-fg', fill: 'bg-status-action-bg text-status-action-fg', dot: 'bg-status-action-dot', border: 'border-status-action-dot/40', bar: 'border-t-status-action-dot', wash: 'bg-status-action-bg/70' },
  success: { text: 'text-status-success-fg', fill: 'bg-status-success-bg text-status-success-fg', dot: 'bg-status-success-dot', border: 'border-status-success-dot/40', bar: 'border-t-status-success-dot', wash: 'bg-status-success-bg/70' },
  danger: { text: 'text-status-danger-fg', fill: 'bg-status-danger-bg text-status-danger-fg', dot: 'bg-status-danger-dot', border: 'border-status-danger-dot/40', bar: 'border-t-status-danger-dot', wash: 'bg-status-danger-bg/70' },
  idle: { text: 'text-status-idle-fg', fill: 'bg-status-idle-bg text-status-idle-fg', dot: 'bg-status-idle-dot', border: 'border-status-idle-dot/40', bar: 'border-t-status-idle-dot', wash: 'bg-status-idle-bg/70' },
}

export function toneClasses(tone: StatusTone): ToneClasses {
  return TONE_CLASSES[tone]
}
