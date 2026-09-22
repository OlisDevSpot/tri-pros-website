/**
 * The splash's choreography in one place (spec C §5.1, review S3). Everything after the blue R
 * is timed from the moment it lands, so retuning the spring moves the caption, the cue and the
 * timed splash's hold together. Easing is not here: `SplashScreen` takes an `ease` prop that
 * defaults to `BRAND_EASE` (§12 S14).
 */

/** The house paths rise one after another. */
export const SPLASH_HOUSE_DELAY_S = 0.1
export const SPLASH_HOUSE_STAGGER_S = 0.12
export const SPLASH_HOUSE_DURATION_S = 0.35

/** The blue R springs in last. */
export const SPLASH_MARK_DELAY_S = 0.9
export const SPLASH_MARK_DURATION_S = 0.5

/** When the R has landed. */
export const SPLASH_MARK_LANDS_S = SPLASH_MARK_DELAY_S + SPLASH_MARK_DURATION_S

/** The caption rises once the mark has landed (E3); the press cue follows it. */
export const SPLASH_CAPTION_DELAY_S = SPLASH_MARK_LANDS_S
export const SPLASH_CAPTION_DURATION_S = 0.42
export const SPLASH_CUE_DELAY_S = SPLASH_CAPTION_DELAY_S + SPLASH_CAPTION_DURATION_S + 0.18
export const SPLASH_CUE_DURATION_S = 0.5

/** How long a timed splash holds: until the mark has landed, plus 100 ms of rest (C40). */
export const SPLASH_VISIBLE_MS = Math.round(SPLASH_MARK_LANDS_S * 1000) + 100
