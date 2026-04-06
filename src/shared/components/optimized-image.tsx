'use client'

import { LoaderIcon, RefreshCwIcon } from 'lucide-react'
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
  /** Keep blur visible after load as a soft background (e.g., behind object-contain images) */
  persistBlur?: boolean
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
  persistBlur = false,
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
      {/* Blur placeholder — shown while loading, optionally persists as background behind image */}
      {isOptimized && file.blurDataUrl && (!loaded || persistBlur) && (
        <img
          src={file.blurDataUrl}
          alt=""
          aria-hidden
          className={cn(
            'absolute inset-0 z-0 h-full w-full object-cover scale-110 blur-xl transition-opacity duration-500',
            loaded && persistBlur ? 'opacity-40' : loaded ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}

      {/* Real image — ALWAYS shown, z-10 to sit above blur */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn(
          'relative z-10 h-full w-full object-cover transition-opacity duration-300',
          isOptimized && file.blurDataUrl && !loaded ? 'opacity-0' : 'opacity-100',
          className,
        )}
      />

      {/* Status badges — only shown when onRetryOptimization is provided (dashboard context) */}
      {onRetryOptimization && isProcessing && (
        <div className="absolute bottom-1 right-1 z-10 flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] text-white/80 backdrop-blur-sm">
          <LoaderIcon size={8} className="animate-spin" />
          Optimizing...
        </div>
      )}

      {onRetryOptimization && isFailed && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            handleRetry()
          }}
          className="absolute bottom-1 right-1 z-10 flex cursor-pointer items-center gap-1 rounded-full bg-red-500/80 px-1.5 py-0.5 text-[9px] text-white backdrop-blur-sm transition-colors hover:bg-red-500"
        >
          <RefreshCwIcon size={8} />
          Retry
        </button>
      )}
    </div>
  )
}
