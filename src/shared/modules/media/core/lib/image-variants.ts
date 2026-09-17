// src/shared/modules/media/core/lib/image-variants.ts

/**
 * Single source of truth for responsive image variants. Dependency-free leaf ON
 * PURPOSE: the client read side (get-optimized-urls.ts) and the server write side
 * (process-image-variants.ts, which imports sharp) BOTH import this — keeping it
 * free of sharp / server-only code is what lets one definition serve both.
 */
export interface VariantOption {
  /** filename suffix + the value stored in `optimizationVariants` */
  suffix: string
  /** target resize width in px; also the srcSet `w` descriptor */
  width: number
  /** output budget; over it the write side re-encodes at lower quality */
  maxBytes: number
}

/**
 * MASTER — every variant the system can produce. The ONLY place a width/budget
 * is declared. Ordered ascending by width. Add a variant = one line here.
 */
export const VARIANT_OPTIONS = [
  { suffix: 'xs', width: 320, maxBytes: 40 * 1024 },
  { suffix: 'sm', width: 640, maxBytes: 80 * 1024 },
  { suffix: 'md', width: 1280, maxBytes: 200 * 1024 },
  { suffix: 'lg', width: 1920, maxBytes: 350 * 1024 },
] as const satisfies readonly VariantOption[]

export type VariantSuffix = (typeof VARIANT_OPTIONS)[number]['suffix']

/**
 * Variants assumed for a row whose `optimizationVariants` was never recorded
 * (predates variant tracking). FROZEN — must stay a subset of what those old
 * objects physically have on R2; NEVER add a newer suffix (e.g. `xs`) here or
 * legacy images would request a `-xs.webp` that doesn't exist (404).
 *
 * Per-owner write-time lists live on each owner's store (`MediaStore.variants`).
 */
export const FALLBACK_VARIANTS = ['sm', 'md', 'lg'] as const satisfies readonly VariantSuffix[]

/** Derived suffix → width lookup. Nobody ever re-declares a width. */
export const VARIANT_WIDTH: Record<string, number>
  = Object.fromEntries(VARIANT_OPTIONS.map(v => [v.suffix, v.width]))
