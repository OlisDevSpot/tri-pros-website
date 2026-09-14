import type { ReputationMark as ReputationMarkData } from '@/features/meeting-flow/types'
import { StarIcon } from 'lucide-react'
import { FaGoogle, FaYelp } from 'react-icons/fa'

interface ReputationMarkProps {
  mark: ReputationMarkData
}

/** One reputation item: a plain fact, or a platform rating with its review count. */
export function ReputationMark({ mark }: ReputationMarkProps) {
  if (mark.kind === 'fact') {
    return (
      <li className="flex items-baseline gap-[0.45em]">
        <span className="font-semibold text-white">{mark.value}</span>
        <span className="text-white/60">{mark.label}</span>
      </li>
    )
  }

  const PlatformIcon = mark.platform === 'Google' ? FaGoogle : FaYelp
  return (
    <li className="flex items-center gap-[0.45em]">
      <PlatformIcon aria-hidden className="size-[0.95em] shrink-0 text-white/80" />
      <span className="sr-only">{mark.platform}</span>
      <span className="font-semibold text-white tabular-nums">{mark.rating}</span>
      <StarIcon aria-hidden className="size-[0.95em] shrink-0 fill-amber-400 text-amber-400" />
      <span className="text-white/60 tabular-nums">
        {mark.count}
        {' '}
        reviews
      </span>
    </li>
  )
}
