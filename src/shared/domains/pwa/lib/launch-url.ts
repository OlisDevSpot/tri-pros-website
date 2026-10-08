import { PWA_LAUNCH_PARAM, PWA_LAUNCH_VALUE } from '@/shared/domains/pwa/constants/launch'

/** True for the URL the installed app launches with: the exact marker, on any path. */
export function isPwaLaunchUrl(url: URL): boolean {
  return url.searchParams.get(PWA_LAUNCH_PARAM) === PWA_LAUNCH_VALUE
}

/** The same URL without the marker, so a link is never answered with the static shell instead of its page. */
export function withoutPwaLaunchMarker(url: URL): URL {
  if (!isPwaLaunchUrl(url)) {
    return url
  }
  const stripped = new URL(url.href)
  stripped.searchParams.delete(PWA_LAUNCH_PARAM)
  return stripped
}
