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
 * narrow inside whatever surface contains it — the landing's first question,
 * every card-select step, and the PII form step share this one width. (The ZIP
 * and address steps constrain their single input narrower still, internally.)
 */
export const FUNNEL_QUESTION_MAX_W = 'max-w-xl'

/**
 * Above this option count, a card-select question renders as a single-column
 * list of rows instead of a 2-column card grid. At `2`, every real question
 * (all are 3+ options; the only 2-option step is the hero-entry `ownership`,
 * which renders via its own panel) lists — so funnels read as a uniform
 * single-column flow. The 2-column grid is retained only as the fallback for a
 * genuine ≤2-tile question. Identical across every funnel — the threshold lives
 * here, not in any per-funnel spec.
 * see docs/superpowers/specs/2026-06-26-funnel-card-select-layout-system-design.md
 */
export const CARD_SELECT_SINGLE_COLUMN_THRESHOLD = 2
