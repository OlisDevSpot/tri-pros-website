/** Showcase photo crossfade: opacity only, the brand easing (`--ease-brand`), 400ms (`--dur-base`). */
export const SHOWCASE_CROSSFADE = { duration: 0.4, ease: [0.32, 0.72, 0, 1] } as const

/** Thumbnails in the "Our projects" strip. */
export const SHOWCASE_PROOF_LIMIT = 4

/** Benefit lines under the outcome on the two-column layout. */
export const SHOWCASE_BENEFIT_LIMIT = 2

/** The portfolio list changes rarely; one fetch per meeting is enough. */
export const SHOWCASE_PROJECTS_STALE_MS = 300_000
