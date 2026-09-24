import type { ReputationMark as ReputationMarkData } from '@/features/meeting-flow/types'
import { ArrowUpRightIcon, StarIcon } from 'lucide-react'
import { FaGoogle, FaYelp } from 'react-icons/fa'

interface ReputationMarkProps {
  mark: ReputationMarkData
}

/**
 * One reputation item: a plain fact, or a platform rating with its review count. A mark with an
 * `href` opens where the homeowner can check it, in a new tab so the meeting stays put; its hit
 * area reaches past the line so a fingertip on a tablet lands it without the row growing.
 */
export function ReputationMark({ mark }: ReputationMarkProps) {
  const body = mark.kind === 'fact'
    ? (
        <>
          <span className="font-semibold text-white">{mark.value}</span>
          <span className="text-white/60">{mark.label}</span>
        </>
      )
    : (
        <>
          {mark.platform === 'Google'
            ? <FaGoogle aria-hidden className="size-[0.95em] shrink-0 self-center text-white/80" />
            : <FaYelp aria-hidden className="size-[0.95em] shrink-0 self-center text-white/80" />}
          <span className="sr-only">{mark.platform}</span>
          <span className="font-semibold text-white tabular-nums">{mark.rating}</span>
          <StarIcon aria-hidden className="size-[0.95em] shrink-0 self-center fill-amber-400 text-amber-400" />
          <span className="text-white/60 tabular-nums">
            {mark.count}
            {' '}
            reviews
          </span>
        </>
      )

  if (!mark.href) {
    return <li className="flex items-baseline gap-[0.45em]">{body}</li>
  }

  return (
    <li className="flex">
      <a
        className="group relative flex items-baseline gap-[0.45em] rounded-sm outline-none before:absolute before:-inset-x-1.5 before:-inset-y-2.5 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        href={mark.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {body}
        <ArrowUpRightIcon aria-hidden className="size-[0.8em] shrink-0 self-center text-white/40 transition-colors group-hover:text-(--presentation-accent)" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </li>
  )
}
