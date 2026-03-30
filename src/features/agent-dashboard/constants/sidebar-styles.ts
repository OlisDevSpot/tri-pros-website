/**
 * Nav item styles for the dashboard sidebar.
 *
 * Uses color-mix with the primary CSS variable for automatic
 * light/dark mode adaptation. Both hover and active use the same
 * gradient language — active is just more saturated.
 *
 * Active: inline style with gradient + shadow + border (10-15% primary)
 * Hover: CSS rule in globals.css targeting [data-nav-item] (5-8% primary)
 */

export const SIDEBAR_NAV_ACTIVE_STYLE = {
  background: `linear-gradient(135deg, color-mix(in oklch, var(--primary) 12%, transparent), color-mix(in oklch, var(--primary) 6%, transparent))`,
  boxShadow: `inset 0 1px 0 0 color-mix(in oklch, var(--primary) 10%, transparent), 0 1px 2px 0 color-mix(in oklch, var(--primary) 8%, transparent)`,
  outline: `1px solid color-mix(in oklch, var(--primary) 15%, transparent)`,
  outlineOffset: '-1px',
} as const satisfies React.CSSProperties
