/**
 * Custom Next.js image loader using Cloudflare Image Transformations.
 *
 * Replaces Vercel's image optimization (which has a 1,000 req/month free tier)
 * with Cloudflare's edge-based transforms (5,000 unique transforms/month free).
 *
 * - Remote images (R2, external): routed through /cdn-cgi/image/ for
 *   auto WebP/AVIF conversion, resizing, and edge caching
 * - Local images (/public/): served as-is (no transformation needed)
 */
export default function cloudflareLoader({
  src,
  width,
  quality,
}: { src: string, width: number, quality?: number }) {
  // Local images (from /public/) — serve directly
  if (src.startsWith('/')) {
    return src
  }

  // Remote images — transform via Cloudflare
  const params = [`width=${width}`, `quality=${quality || 75}`, 'format=auto']
  return `https://triprosremodeling.com/cdn-cgi/image/${params.join(',')}/${src}`
}
