import type { CSSProperties } from 'react'

// The glass popover's keys are inline styles, so only an inline override wins.
export const PROPOSAL_CONTEXT_POPOVER_STYLE: CSSProperties = {
  backgroundColor: 'var(--popover)',
  backgroundImage: 'none',
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
}
