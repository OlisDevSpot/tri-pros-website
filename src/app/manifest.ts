import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tri Pros Remodeling',
    short_name: 'TPR',
    start_url: '/dashboard',
    // Scope MUST be "/" for declarative web push deep links to open the
    // standalone PWA. Without this, scope defaults to the directory of
    // start_url (/dashboard/), and pushes with `navigate: "/customers/123"`
    // open in Safari instead of routing into the installed app.
    scope: '/',
    display: 'standalone',
    background_color: '#09090b',
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
    ],
  }
}
