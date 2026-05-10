import env from '@/shared/config/server-env'
import { DECLARATIVE_WEB_PUSH_FORMAT } from './constants'

export interface PushPayloadInput {
  title: string
  body?: string
  /**
   * Path or absolute URL the PWA should open when the notification is tapped.
   * Relative paths are resolved against NEXT_PUBLIC_BASE_URL so the absolute
   * URL is in-scope of the manifest (manifest scope must be "/" for any path
   * to route into the standalone PWA on iOS).
   */
  navigate: string
  icon?: string
  badge?: string
  tag?: string
  silent?: boolean
  /**
   * Number to display as the PWA app-icon badge. 0 clears it. iOS supports
   * this via the App Badging API exposed through Declarative Web Push.
   */
  appBadge?: number
}

// Wire format: { web_push: 8030, notification: { title, body, navigate,
// app_badge?, icon?, badge?, tag?, silent? } }. The shape is fixed by the
// W3C Push API addendum; field names are snake_case on the wire even though
// our TS API exposes them camelCase.
export interface DeclarativeWebPushPayload {
  web_push: typeof DECLARATIVE_WEB_PUSH_FORMAT
  notification: {
    title: string
    body?: string
    navigate: string
    icon?: string
    badge?: string
    tag?: string
    silent?: boolean
    app_badge?: number
  }
}

export function buildPushPayload(input: PushPayloadInput): DeclarativeWebPushPayload {
  const navigateUrl = resolveNavigateUrl(input.navigate)

  // Drop optional fields that are undefined so the wire payload is minimal.
  // iOS APNS has a small payload size budget (~4KB after VAPID overhead).
  const notification: DeclarativeWebPushPayload['notification'] = {
    title: input.title,
    navigate: navigateUrl,
  }

  if (input.body !== undefined) {
    notification.body = input.body
  }
  if (input.icon !== undefined) {
    notification.icon = input.icon
  }
  if (input.badge !== undefined) {
    notification.badge = input.badge
  }
  if (input.tag !== undefined) {
    notification.tag = input.tag
  }
  if (input.silent !== undefined) {
    notification.silent = input.silent
  }
  if (input.appBadge !== undefined) {
    notification.app_badge = input.appBadge
  }

  return {
    web_push: DECLARATIVE_WEB_PUSH_FORMAT,
    notification,
  }
}

// Resolve `/customers/123` -> `https://app.example.com/customers/123`. iOS
// only routes the deep link into the standalone PWA when the navigate URL
// matches the origin the PWA was installed FROM. NGROK_URL takes precedence
// during tunnel testing so dev pushes deep-link into the ngrok-installed
// PWA instead of bouncing the user to Safari at the prod origin. This
// matches the codebase pattern for any "public URL for external callbacks"
// (see scheduling.service.ts, upstash/lib/create-job.ts).
function resolveNavigateUrl(navigate: string): string {
  if (/^https?:\/\//i.test(navigate)) {
    return navigate
  }
  const baseUrl = env.NGROK_URL ?? env.NEXT_PUBLIC_BASE_URL
  return new URL(navigate, baseUrl).href
}
