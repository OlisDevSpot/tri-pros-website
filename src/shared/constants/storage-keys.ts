/** Shared localStorage namespace prefix. Every app key derives from this. */
export const STORAGE_KEY_PREFIX = 'tri-pros:'

/** Centralized localStorage key constants. Use these instead of inline strings. */
export const STORAGE_KEYS = {
  ACTIVE_PIPELINE: `${STORAGE_KEY_PREFIX}active-pipeline`,
  MEETINGS_SCOPE: `${STORAGE_KEY_PREFIX}meetings-scope`,
  SCHEDULE_SCOPE: `${STORAGE_KEY_PREFIX}schedule-scope`,
  PROPOSALS_SCOPE: `${STORAGE_KEY_PREFIX}proposals-scope`,
} as const

/**
 * A `sessionStorage` key under the shared namespace, e.g. `sessionStorageKey('meeting-splash', id)`
 * → `tri-pros:meeting-splash:<id>`. Features declare their keys beside the hook that reads them
 * (spec C §12 S16); nothing shared decides when a key is written.
 */
export function sessionStorageKey(...parts: string[]): string {
  return `${STORAGE_KEY_PREFIX}${parts.join(':')}`
}
