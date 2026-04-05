'use client'

import { AlertTriangleIcon } from 'lucide-react'
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
  const isOptimized = file.optimizationStatus === 'optimized'
  const isFailed = file.optimizationStatus === 'failed'
  const isProcessing = file.optimizationStatus === 'pending' || file.optimizationStatus === 'processing'

  return (
    <div className={cn('relative overflow-hidden', fill && 'absolute inset-0', containerClassName)}>
      {/* Blur placeholder — only for optimized images during load */}
      {isOptimized && file.blurDataUrl && !loaded && (
        <img
          src={file.blurDataUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover scale-110 blur-xl"
        />
      )}

      {/* Real image — ALWAYS shown (original for pending/failed, optimized variant for optimized) */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        onLoad={() => setLoaded(true)}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          isOptimized && file.blurDataUrl && !loaded ? 'opacity-0' : 'opacity-100',
          className,
        )}
      />

      {/* Processing indicator — subtle badge, image still visible underneath */}
      {isProcessing && (
        <div className="absolute bottom-1 right-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] text-white/80 backdrop-blur-sm">
          Optimizing...
        </div>
      )}

      {/* Failed indicator */}
      {isFailed && (
        <div className="absolute bottom-1 right-1 flex items-center gap-1 rounded-full bg-red-500/80 px-1.5 py-0.5 text-[9px] text-white backdrop-blur-sm">
          <AlertTriangleIcon size={8} />
          Unoptimized
        </div>
      )}
    </div>
  )
}
