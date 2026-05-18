// HTTP status codes that mean "this subscription is gone, stop trying".
// Apple's web.push.apple.com returns 401/403 for invalid VAPID auth or a
// dead subscription (it doesn't disambiguate). 404 means the endpoint is
// unknown to the push service. 410 is RFC 8030's explicit "unsubscribed".
// In practice on Apple's service, all four mean "delete the row".
export const DEAD_PUSH_STATUS_CODES = [401, 403, 404, 410] as const

// RFC 8030 declarative web-push payload format identifier. The integer
// `8030` references the RFC. WebKit (Safari 18.4+) unwraps `notification`
// and displays it directly; older browsers/Chromium deliver the raw JSON
// to the SW's `push` event handler, which reads the same fields.
export const DECLARATIVE_WEB_PUSH_FORMAT = 8030

// Default TTL for transient app notifications. iOS will hold a push for at
// most this long if the device is offline. 24h is the right default for
// "you have a new lead" / "your proposal was viewed" — older than that and
// the notification is no longer actionable.
export const DEFAULT_PUSH_TTL_SECONDS = 60 * 60 * 24
