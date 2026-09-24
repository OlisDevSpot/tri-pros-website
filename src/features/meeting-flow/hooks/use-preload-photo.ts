'use client'

import type { ProjectMediaFile } from '@/shared/db/schema'
import { useEffect } from 'react'
import { getOptimizedSrc, getOptimizedSrcSet } from '@/shared/lib/get-optimized-urls'

/** Fetches the photo Space shows next, so the crossfade never lands on a blank frame. */
export function usePreloadPhoto(file: ProjectMediaFile | null): void {
  useEffect(() => {
    if (!file) {
      return
    }
    const image = new window.Image()
    image.sizes = '100vw'
    image.srcset = getOptimizedSrcSet(file) ?? ''
    image.src = getOptimizedSrc(file)
  }, [file])
}
