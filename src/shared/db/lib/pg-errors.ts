/**
 * Postgres error code helpers. The `pg` driver surfaces server errors as
 * objects with a `code` property containing the SQLSTATE code.
 *
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

const UNIQUE_VIOLATION = '23505'

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object'
    && err !== null
    && 'code' in err
    && (err as { code: unknown }).code === UNIQUE_VIOLATION
}
