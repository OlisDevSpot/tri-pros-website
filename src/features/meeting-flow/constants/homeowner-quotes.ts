/** How many homeowners the agent can switch between on the Performance slide. */
export const HOMEOWNER_QUOTE_LIMIT = 3

/**
 * Longer quotes are skipped rather than clamped: clipped words read as a defect. Measured at
 * 820x1180 (the 564px-wide portrait-tablet presentation container) across several real
 * testimonial-length sentences, the shortest fit four lines at 216 characters; rounded down.
 */
export const HOMEOWNER_QUOTE_MAX_LENGTH = 210
