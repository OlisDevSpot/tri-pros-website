/**
 * Computes the earliest **legal** project start date for a California
 * home improvement contract, accounting for the buyer's right to
 * rescind under Cal. Civil Code §1689.6 / §1689.7.
 *
 * Statutory rule (post AB 2471, effective 2021-01-01):
 *  - Standard contracts: 3 business-day cancellation window.
 *  - Senior contracts (buyer is 65 or older): 5 business-day window.
 *  - "Business day" per Cal. Civil Code §1689.5: any calendar day
 *    EXCEPT Sunday (Saturdays count) and 9 named federal holidays.
 *  - Window starts the day AFTER signing — signing day itself is Day 0
 *    and does not count.
 *  - Cancellation valid until midnight of the Nth business day; the
 *    earliest legal start date is the next calendar day after that.
 *
 * **Holiday handling**: this implementation excludes only Sundays. The
 * 9 named holidays in §1689.5 (New Year's, Washington's Birthday,
 * Memorial Day, Independence Day, Labor Day, Columbus Day, Veterans'
 * Day, Thanksgiving, Christmas) are intentionally NOT guarded against
 * to keep the implementation simple. In edge cases where signing falls
 * just before a long weekend, the actual cancellation window may run
 * one calendar day longer than this function reports — the start date
 * we display would be slightly aggressive (within the cancellation
 * window). If that ever bites, add a holiday list keyed off the
 * signing year and skip those dates in `isBusinessDay`.
 */

const NON_SENIOR_BUSINESS_DAYS = 3
const SENIOR_BUSINESS_DAYS = 5

function isBusinessDay(date: Date): boolean {
  // Sunday is the only weekday excluded by §1689.5's default rule.
  return date.getDay() !== 0
}

function addCalendarDay(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d
}

/**
 * Returns the earliest calendar date on which work may legally begin
 * for a contract signed on `signingDate`, given the buyer's senior
 * status. Pure function — no I/O, no time-of-day sensitivity beyond
 * the calendar date of `signingDate`.
 */
export function cslbEarliestStartDate(signingDate: Date, isSenior: boolean): Date {
  const required = isSenior ? SENIOR_BUSINESS_DAYS : NON_SENIOR_BUSINESS_DAYS

  // Walk forward from signing day until we've passed `required` business
  // days. The signing day itself does not count.
  let cursor = new Date(signingDate)
  let businessDaysCounted = 0
  while (businessDaysCounted < required) {
    cursor = addCalendarDay(cursor)
    if (isBusinessDay(cursor)) {
      businessDaysCounted++
    }
  }

  // `cursor` is now the Nth business day after signing — cancellation
  // expires at midnight of this day. Earliest legal start is the next
  // calendar day.
  return addCalendarDay(cursor)
}
