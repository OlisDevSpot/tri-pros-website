import type { MetadataRoute } from 'next'
import { ROOTS } from '@/shared/config/roots'
import { PWA_LAUNCH_FIELD, PWA_START_URL } from '@/shared/domains/pwa/constants/launch'

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Pinned, so start_url can change without the installed app becoming a different app.
    id: ROOTS.dashboard.root,
    name: 'Tri Pros Remodeling',
    short_name: 'TPR',
    // The marker is what the service worker answers with the launch shell; nothing else ever carries it.
    start_url: PWA_START_URL,
    // Scope MUST be "/" for declarative web push deep links to open the
    // standalone PWA. Without this, scope defaults to the directory of
    // start_url (/dashboard/), and pushes with `navigate: "/customers/123"`
    // open in Safari instead of routing into the installed app.
    scope: '/',
    display: 'standalone',
    background_color: PWA_LAUNCH_FIELD,
    theme_color: '#03AFED',
    orientation: 'portrait',
    icons: [
      {
        src: '/pwa/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/pwa/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      // Android's splash prefers a maskable icon and masks it; this one keeps the mark inside the safe zone.
      {
        src: '/pwa/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
