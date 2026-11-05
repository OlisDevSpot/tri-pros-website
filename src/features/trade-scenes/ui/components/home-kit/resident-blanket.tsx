'use client'

import type { ResidentPose } from '@/features/trade-scenes/types'

import { BLANKET_BOXES } from '@/features/trade-scenes/constants/resident-looks'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

interface ResidentBlanketProps {
  pose: ResidentPose
  color: string
}

export function ResidentBlanket({ pose, color }: ResidentBlanketProps) {
  return <MergedBoxes boxes={BLANKET_BOXES[pose]} color={color} radius={0.13} roughness={1} castShadow />
}
