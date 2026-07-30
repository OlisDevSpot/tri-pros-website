/** Entity-name constant. Source of truth for `EntityName` / `AppSubject`. */
export const APPLICATION = 'Application' as const

/**
 * The one reserved answer key `submitApplication` special-cases: its value is
 * a `tradeId[]` that routes to `x_application_trades` instead of
 * `application_answers`. The multi-select-trades step (sub-project #2) MUST
 * write its selection under this exact key.
 * see ../DOCS.md#trades-question-key-seam
 */
export const TRADES_QUESTION_KEY = 'trades' as const
