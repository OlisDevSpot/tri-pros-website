'use client'

import type { ReactNode } from 'react'
import type { AnimationClip } from 'three'

import { useGltfAsset } from '@/shared/components/scene/hooks/use-gltf-asset'
import { LoadedFigure } from '@/shared/components/scene/ui/loaded-figure'

interface AnimatedFigureProps {
  url: string
  clip: string
  /** Seconds into the clip where its held pose begins; the figure plays and rests from there. */
  clipFrom?: number
  /** A code-built additive clip layered over `clip`, for a gesture the pack lacks; it rests on its first frame. */
  overlay?: AnimationClip | null
  palette: Record<string, string>
  running: boolean
  /** 1 to 0, read each frame while running: the motion slows with it, so a burst winds down instead of stopping dead. */
  pace?: () => number
  thermal?: { color: string }
  fallback: ReactNode
}

export function AnimatedFigure({ url, fallback, ...rest }: AnimatedFigureProps) {
  const asset = useGltfAsset(url)
  return asset ? <LoadedFigure asset={asset} {...rest} /> : fallback
}
