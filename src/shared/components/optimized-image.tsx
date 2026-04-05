'use client'

import { AlertTriangleIcon, LoaderIcon, RefreshCwIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { getOptimizedSrc, getOptimizedSrcSet } from '@/shared/lib/get-optimized-urls'
import { cn } from '@/shared/lib/utils'

interface OptimizedImageProps {
  file: {
    id?: number
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
  onRetryOptimization?: (mediaFileId: number) => void
}

const DEFAULT_SIZES = '(max-width: 640px) 640px, (max-width: 1280px) 1920px'
const TIMEOUT_MS = 20_000

export function OptimizedImage({
  file,
  alt,
  sizes = DEFAULT_SIZES,
  priority = false,
  className,
  containerClassName,
  fill = false,
  onRetryOptimization,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const src = getOptimizedSrc(file)
  const srcSet = getOptimizedSrcSet(file)
  const isOptimized = file.optimizationStatus === 'optimized'
  const isFailed = file.optimizationStatus === 'failed' || timedOut
  const isProcessing = !isOptimized && !isFailed
    && (file.optimizationStatus === 'pending' || file.optimizationStatus === 'processing')

  // Client-side timeout: if still processing after 20s, show as failed
  useEffect(() => {
    if (isProcessing) {
      timerRef.current = setTimeout(() => setTimedOut(true), TIMEOUT_MS)
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
        }
      }
    }

    // Reset timeout if status changes to optimized
    setTimedOut(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
  }, [file.optimizationStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRetry() {
    if (file.id && onRetryOptimization) {
      setTimedOut(false)
      onRetryOptimization(file.id)
    }
  }

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

      {/* Real image — ALWAYS shown */}
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

      {/* Processing indicator */}
      {isProcessing && (
        <div className="absolute bottom-1 right-1 flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] text-white/80 backdrop-blur-sm">
          <LoaderIcon size={8} className="animate-spin" />
          Optimizing...
        </div>
      )}

      {/* Failed / timed out indicator with retry */}
      {isFailed && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={!file.id || !onRetryOptimization}
          className="absolute bottom-1 right-1 flex cursor-pointer items-center gap-1 rounded-full bg-red-500/80 px-1.5 py-0.5 text-[9px] text-white backdrop-blur-sm transition-colors hover:bg-red-500 disabled:cursor-default disabled:hover:bg-red-500/80"
        >
          {file.id && onRetryOptimization
            ? <RefreshCwIcon size={8} />
            : <AlertTriangleIcon size={8} />}
          {file.id && onRetryOptimization ? 'Retry' : 'Unoptimized'}
        </button>
      )}
    </div>
  )
}
