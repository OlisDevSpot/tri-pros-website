/**
 * Nav item styles for the dashboard sidebar.
 *
 * Uses color-mix with the primary CSS variable for automatic
 * light/dark mode adaptation. Both hover and active use the same
 * gradient language — active is just more saturated.
 *
 * Active: inline style with gradient + shadow + border (10-15% primary)
 * Hover: SIDEBAR_NAV_ITEM_CLASS (6% primary). Important because it must beat the
 * shadcn menu-button hover and transition utilities.
 */

export const SIDEBAR_NAV_ACTIVE_STYLE = {
  background: `linear-gradient(135deg, color-mix(in oklch, var(--primary) 12%, transparent), color-mix(in oklch, var(--primary) 6%, transparent))`,
  boxShadow: `inset 0 1px 0 0 color-mix(in oklch, var(--primary) 10%, transparent), 0 1px 2px 0 color-mix(in oklch, var(--primary) 8%, transparent)`,
  outline: `1px solid color-mix(in oklch, var(--primary) 15%, transparent)`,
  outlineOffset: '-1px',
} as const satisfies React.CSSProperties

export const SIDEBAR_NAV_ITEM_CLASS = '[transition:background_200ms_ease,color_200ms_ease]! [&:not([data-active=true]):hover]:bg-[color-mix(in_oklch,var(--primary)_6%,transparent)]! [&:not([data-active=true]):hover_svg]:text-primary [&:not([data-active=true]):hover_svg]:[transition:color_200ms_ease]'
