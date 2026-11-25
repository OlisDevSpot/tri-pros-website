'use client'

import type { ReactNode } from 'react'
import { useEditLoading } from '@/features/proposal-flow/contexts/edit-loading-context'
import { SKELETON_BLOCK_TONE_CLASS, SKELETON_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { cn } from '@/shared/lib/utils'

interface Props {
  width: number
  block?: boolean
  className?: string
  children: ReactNode
}

// A span, not Skeleton (a div): it sits inside p, button, dd and s. The width goes through style because a
// class built at runtime is never generated.
export function LoadingValue({ width, block, className, children }: Props) {
  const loading = useEditLoading()
  if (!loading) {
    return children
  }
  return (
    <span
      aria-hidden
      data-slot="loading-value"
      style={{ width }}
      className={cn(
        'inline-block h-[.72em] rounded-sm align-baseline motion-safe:animate-pulse',
        block ? SKELETON_BLOCK_TONE_CLASS : SKELETON_TONE_CLASS,
        className,
      )}
    />
  )
}
