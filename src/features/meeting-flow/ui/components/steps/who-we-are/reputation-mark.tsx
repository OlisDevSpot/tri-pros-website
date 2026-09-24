import type { ReputationMark as ReputationMarkData } from '@/features/meeting-flow/types'
import { ArrowUpRightIcon, StarIcon } from 'lucide-react'
import { FaYelp } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'

interface ReputationMarkProps {
  mark: ReputationMarkData
}

/**
 * One public rating as a button that opens where the homeowner can check it, in a new tab so
 * the meeting stays put. Each platform's mark sits on a white chip in its own colours, the way
 * the homeowner knows it from the platform itself. BBB has no mark in the icon set, so its chip
 * carries the wordmark, as the funnel's trust badges do.
 */
export function ReputationMark({ mark }: ReputationMarkProps) {
  return (
    <li className="flex min-w-0">
      <a
        className="group relative grid min-h-14 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-[0.6em] rounded-lg border border-white/12 bg-white/[0.04] py-[0.5em] pr-[1.4em] pl-[0.5em] text-presentation-body transition-colors outline-none hover:border-white/25 hover:bg-white/[0.08] focus-visible:ring-[3px] focus-visible:ring-ring/50 active:bg-white/[0.12] @max-[30rem]/presentation:grid-cols-1 @max-[30rem]/presentation:justify-items-center @max-[30rem]/presentation:gap-y-1 @max-[30rem]/presentation:px-1 @max-[30rem]/presentation:text-center"
        href={mark.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span aria-hidden className="grid size-[2.2em] place-items-center rounded-md bg-white">
          {mark.platform === 'Google' && <FcGoogle className="size-[1.25em]" />}
          {mark.platform === 'Yelp' && <FaYelp className="size-[1.2em] text-[#d32323]" />}
          {mark.platform === 'BBB' && <span className="text-[0.72em] font-black text-[#00567a]">BBB</span>}
        </span>
        <span className="grid min-w-0 leading-tight">
          <span className="sr-only">{mark.platform}</span>
          {mark.kind === 'stars'
            ? (
                <>
                  <span className="flex items-center gap-[0.3em] font-semibold text-white tabular-nums @max-[30rem]/presentation:justify-center">
                    {mark.rating}
                    <StarIcon aria-hidden className="size-[0.85em] shrink-0 fill-amber-400 text-amber-400" />
                  </span>
                  <span className="truncate text-presentation-label text-white/60 tabular-nums">
                    {mark.count}
                    {' '}
                    reviews
                  </span>
                </>
              )
            : (
                <>
                  <span className="font-semibold text-white">{mark.grade}</span>
                  <span className="truncate text-presentation-label text-white/60">BBB rating</span>
                </>
              )}
        </span>
        <ArrowUpRightIcon aria-hidden className="absolute top-[0.45em] right-[0.45em] size-[0.75em] text-white/35 transition-colors group-hover:text-(--presentation-accent)" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </li>
  )
}
