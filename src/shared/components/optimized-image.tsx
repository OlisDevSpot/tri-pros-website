'use client'

import { useState } from 'react'

import { getOptimizedSrc, getOptimizedSrcSet } from '@/shared/lib/get-optimized-urls'
import { cn } from '@/shared/lib/utils'

interface OptimizedImageProps {
  file: {
    url: string
    pathKey: string
    bucket: string
    optimizationStatus: string
    blurDataUrl?: string | null
  }
  alt: string
  sizes?: string
  priority?: boolean
  className?: string
  containerClassName?: string
  fill?: boolean
}

const DEFAULT_SIZES = '(max-width: 640px) 640px, (max-width: 1280px) 1280px, 1920px'

export function OptimizedImage({
  file,
  alt,
  sizes = DEFAULT_SIZES,
  priority = false,
  className,
  containerClassName,
  fill = false,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false)
  const src = getOptimizedSrc(file)
  const srcSet = getOptimizedSrcSet(file)
  const isProcessing = file.optimizationStatus === 'pending' || file.optimizationStatus === 'processing'

  return (
    <div className={cn('relative overflow-hidden', fill && 'absolute inset-0', containerClassName)}>
      {/* Blur placeholder */}
      {file.blurDataUrl && (
        <img
          src={file.blurDataUrl}
          alt=""
          aria-hidden
          className={cn(
            'absolute inset-0 h-full w-full object-cover scale-110 blur-xl transition-opacity duration-500',
            loaded ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}

      {/* Processing shimmer */}
      {isProcessing && !file.blurDataUrl && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}

      {/* Real image */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        onLoad={() => setLoaded(true)}
        className={cn('h-full w-full object-cover', className)}
      />
    </div>
  )
}
