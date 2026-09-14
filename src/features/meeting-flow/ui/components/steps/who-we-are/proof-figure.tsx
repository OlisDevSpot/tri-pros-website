'use client'

import type { ProofFigure as ProofFigureData } from '@/features/meeting-flow/types'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'

interface ProofFigureProps {
  proof: ProofFigureData
  order: number
}

/** The point's one big figure, in the accent, with what it means beside it. */
export function ProofFigure({ proof, order }: ProofFigureProps) {
  return (
    <Reveal className="mt-[1cqh] flex flex-wrap items-baseline gap-x-[1.5cqw] gap-y-1" order={order}>
      <span className="font-sans text-[5.5cqw] leading-none font-bold tracking-tight text-(--presentation-accent) tabular-nums lg:text-[3.8cqw]">
        {proof.value}
      </span>
      <span className="max-w-[30ch] text-[max(2.2cqw,0.75rem)] text-white/65 lg:text-[max(1.4cqw,0.75rem)]">{proof.label}</span>
    </Reveal>
  )
}
