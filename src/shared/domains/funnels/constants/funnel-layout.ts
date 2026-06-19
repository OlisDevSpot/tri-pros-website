/**
 * The single content-rail width for every funnel surface — landing, question
 * steps, and the terminal confirmation — plus the sticky header. Every section
 * fills this rail (`w-full`); content that should read narrower (a focused
 * single input, body prose) constrains INTERNALLY with its own `max-w-*`.
 * Desktop caps at 5xl; on mobile the `px-5` gutter governs.
 */
export const FUNNEL_RAIL_MAX_W = 'max-w-5xl'
