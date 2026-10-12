import { ROOTS } from '@/shared/config/roots'
import { PWA_LAUNCH_FIELD, PWA_LAUNCH_PARAM, PWA_LAUNCH_VALUE, PWA_SCREEN_HEIGHT_VAR } from '@/shared/domains/pwa/constants/launch'

const STYLE_ID = 'tpr-launch-field'

/**
 * Runs in <head>, before any of the body is parsed: on a launch document the page itself is the launch field
 * from its first frame. iOS can show a frame of the page before the cover is painted, and without this it
 * showed the theme's background there, a light flash between the startup image and the cover. It also writes
 * the screen's height for the cover; iOS keeps screen.width and screen.height in portrait terms, so the
 * orientation picks the side. The test repeats isPwaLaunchUrl and the shell route, because no module has
 * loaded yet.
 */
export const PWA_LAUNCH_FIELD_SCRIPT = `(function(){try{var u=new URL(location.href);if(u.searchParams.get(${JSON.stringify(PWA_LAUNCH_PARAM)})===${JSON.stringify(PWA_LAUNCH_VALUE)}||u.pathname===${JSON.stringify(ROOTS.pwa.shell)}){var s=document.createElement('style');s.id=${JSON.stringify(STYLE_ID)};var h=matchMedia('(orientation: landscape)').matches?Math.min(screen.width,screen.height):Math.max(screen.width,screen.height);s.textContent=':root{${PWA_SCREEN_HEIGHT_VAR}:'+h+'px}html,body{background-color:${PWA_LAUNCH_FIELD}!important}';document.head.appendChild(s)}}catch(e){}})()`

/** Hands the page back its own background; a no-op on any document that never had the field. */
export function liftPwaLaunchField() {
  document.getElementById(STYLE_ID)?.remove()
}
