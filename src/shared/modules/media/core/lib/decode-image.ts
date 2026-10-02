/**
 * Fetches and decodes one image off-screen. `sizes` is set before `srcset` and `src` so the browser
 * picks the same variant the page's own <img> with that `sizes` will pick, and serves it from cache.
 */
export function decodeImage({ src, srcSet, sizes }: { src: string, srcSet?: string, sizes?: string }): Promise<void> {
  const image = new window.Image()
  if (sizes) {
    image.sizes = sizes
  }
  if (srcSet) {
    image.srcset = srcSet
  }
  image.src = src
  return image.decode()
}
