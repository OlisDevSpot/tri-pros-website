/**
 * Active nav item styles for the dashboard sidebar.
 *
 * Uses color-mix with the primary CSS variable for automatic
 * light/dark mode adaptation. The gradient, border, and shadow
 * create a subtle "selected" treatment without being heavy.
 */
export const SIDEBAR_NAV_ACTIVE_STYLE = {
  background: `linear-gradient(135deg, color-mix(in oklch, var(--primary) 12%, transparent), color-mix(in oklch, var(--primary) 6%, transparent))`,
  boxShadow: `inset 0 1px 0 0 color-mix(in oklch, var(--primary) 10%, transparent), 0 1px 2px 0 color-mix(in oklch, var(--primary) 8%, transparent)`,
  outline: `1px solid color-mix(in oklch, var(--primary) 15%, transparent)`,
  outlineOffset: '-1px',
} as const satisfies React.CSSProperties
