/**
 * The single content-rail width for every funnel surface — landing, question
 * steps, and the terminal confirmation — plus the sticky header. Every section
 * fills this rail (`w-full`); content that should read narrower (a focused
 * single input, body prose) constrains INTERNALLY with its own `max-w-*`.
 * Desktop caps at 5xl; on mobile the `px-5` gutter governs.
 */
export const FUNNEL_RAIL_MAX_W = 'max-w-5xl'

/**
 * The narrow rail for an individual question's content (heading + options).
 * A question reads as a focused, single-column prompt rather than spanning the
 * full `FUNNEL_RAIL_MAX_W`. Applied internally + centered (`mx-auto`) so it sits
 * narrow inside whatever surface contains it — the landing's first question and
 * every subsequent card-select step share this one width.
 */
export const FUNNEL_QUESTION_MAX_W = 'max-w-xl'
