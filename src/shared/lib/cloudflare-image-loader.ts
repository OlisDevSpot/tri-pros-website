/**
 * Custom Next.js image loader.
 *
 * When NEXT_PUBLIC_CF_IMAGE_TRANSFORMS=true (set after DNS migration to
 * Cloudflare), routes remote images through /cdn-cgi/image/ for auto
 * WebP/AVIF, resizing, and edge caching (5,000 free transforms/month).
 *
 * When disabled (default), serves remote images directly from source —
 * no optimization but no Vercel quota usage either.
 *
 * Local images (/public/) are always served directly.
 */

// eslint-disable-next-line node/prefer-global/process
const CF_TRANSFORMS_ENABLED = process.env.NEXT_PUBLIC_CF_IMAGE_TRANSFORMS === 'true'
const CF_DOMAIN = 'https://triprosremodeling.com'

export default function cloudflareLoader({
  src,
  width,
  quality,
}: { src: string, width: number, quality?: number }) {
  // Local images (from /public/) — serve directly
  if (src.startsWith('/')) {
    return src
  }

  // Cloudflare Image Transforms — enabled after DNS migration
  if (CF_TRANSFORMS_ENABLED) {
    const params = [`width=${width}`, `quality=${quality || 75}`, 'format=auto']
    return `${CF_DOMAIN}/cdn-cgi/image/${params.join(',')}/${src}`
  }

  // Fallback — serve original image directly from R2 (no optimization)
  return src
}
