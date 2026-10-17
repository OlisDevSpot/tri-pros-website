/** When nothing matches the selected scopes or trades, this many projects lead instead. */
export const FALLBACK_MATCH_COUNT = 3

/** Project details fetched ahead of the one on screen, so the next project lands on loaded photos. */
export const PREFETCH_AHEAD = 2

/** The portfolio changes rarely; one fetch per meeting or proposal visit is enough. */
export const SHOWCASE_PROJECTS_STALE_MS = 300_000
