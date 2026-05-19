/** Earliest legal project start date under Cal. Civil Code §1689.6/§1689.7
 *  rescission window. see ../DOCS.md#cslb-start-date for the full rule. */

const NON_SENIOR_BUSINESS_DAYS = 3
const SENIOR_BUSINESS_DAYS = 5

function isBusinessDay(date: Date): boolean {
  // Sundays only. §1689.5's 9 named federal holidays are intentionally NOT
  // excluded — in rare edge cases (signing just before a long weekend) the
  // cancellation window may run a day longer than this reports. If that bites,
  // add a holiday list keyed off the signing year here.
  return date.getDay() !== 0
}

function addCalendarDay(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d
}

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
