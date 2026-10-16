/** One cookie per table, `dt.<tableId>`, so one table's write never rewrites another's. */
export const TABLE_PREFERENCES_COOKIE_PREFIX = 'dt.'

export const TABLE_PREFERENCES_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Every DataTable renders under the dashboard; the public site's requests don't carry these.
export const TABLE_PREFERENCES_COOKIE_PATH = '/dashboard'
