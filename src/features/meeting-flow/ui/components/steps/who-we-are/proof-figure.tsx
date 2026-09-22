'use client'

import type { ProofFigure as ProofFigureData } from '@/features/meeting-flow/types'
import { Reveal } from '@/shared/components/presentation/reveal'

interface ProofFigureProps {
  proof: ProofFigureData
  order: number
}

/** The point's one big figure, in the accent, with what it means beside it. One size on every slide (U5). */
export function ProofFigure({ proof, order }: ProofFigureProps) {
  return (
    <Reveal className="flex flex-wrap items-baseline gap-x-presentation-tight gap-y-1" order={order}>
      <span className="font-sans text-presentation-figure leading-none font-bold tracking-tight text-(--presentation-accent) tabular-nums lining-nums">
        {proof.value}
      </span>
      <span className="max-w-[30ch] text-presentation-label text-white/65">{proof.label}</span>
    </Reveal>
  )
}
