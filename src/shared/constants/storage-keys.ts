/** Shared localStorage namespace prefix. Every app key derives from this. */
export const STORAGE_KEY_PREFIX = 'tri-pros:'

/** Centralized localStorage key constants. Use these instead of inline strings. */
export const STORAGE_KEYS = {
  ACTIVE_PIPELINE: `${STORAGE_KEY_PREFIX}active-pipeline`,
  MEETINGS_SCOPE: `${STORAGE_KEY_PREFIX}meetings-scope`,
  SCHEDULE_SCOPE: `${STORAGE_KEY_PREFIX}schedule-scope`,
  PROPOSALS_SCOPE: `${STORAGE_KEY_PREFIX}proposals-scope`,
} as const
