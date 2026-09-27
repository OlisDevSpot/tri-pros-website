import type { CSSProperties } from 'react'

// Inline, not Tailwind's backdrop-blur-*: Chrome's compositor drops the class's CSS-var chain on portal-rendered, 3D-transformed elements.
export const GLASS_SURFACE_STYLE = {
  backgroundColor: 'var(--popover-glass)',
  backgroundImage: 'var(--popover-glass-overlay)',
  backdropFilter: 'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  boxShadow: 'var(--popover-glass-shadow)',
} as const satisfies CSSProperties
