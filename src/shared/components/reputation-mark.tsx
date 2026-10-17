import type { CSSProperties } from 'react'
import { ArrowUpRightIcon, StarIcon } from 'lucide-react'
import { FaYelp } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { STAR_MASK_IMAGE } from '@/shared/constants/star-mask'

/** A public rating; `href` opens where the homeowner can check it. */
export type ReputationMarkData
  = | { kind: 'stars', platform: 'Google' | 'Yelp', rating: string, count: number, href: string }
    | { kind: 'grade', platform: 'BBB', grade: string, href: string }

interface ReputationMarkProps {
  mark: ReputationMarkData
  /** `presentation`: the white-on-navy chip of the meeting's slides. `page`: a card on a themed page. */
  tone?: 'presentation' | 'page'
}

/**
 * One public rating as a button that opens where the homeowner can check it, in a new tab so
 * the page stays put. Each platform's mark sits on a white chip in its own colours, the way
 * the homeowner knows it from the platform itself. BBB has no mark in the icon set, so its chip
 * carries the wordmark, as the funnel's trust badges do.
 */
export function ReputationMark({ mark, tone = 'presentation' }: ReputationMarkProps) {
  if (tone === 'page') {
    return (
      <li className="flex min-w-0">
        <a
          className="grid w-full min-w-0 grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors outline-none hover:border-border-strong focus-visible:ring-[3px] focus-visible:ring-ring/50"
          href={mark.href}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span aria-hidden className="row-span-2 grid size-9 place-items-center rounded-[10px] bg-white shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]">
            {mark.platform === 'Google' && <FcGoogle className="size-6" />}
            {mark.platform === 'Yelp' && <FaYelp className="size-6 text-[#d32323]" />}
            {/* eslint-disable-next-line heavy-font-weight/no-heavy-font-weight -- copies the BBB logotype */}
            {mark.platform === 'BBB' && <span className="text-sm leading-none font-black text-[#00567a]">BBB</span>}
          </span>
          <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
            <span className="font-sans text-xl leading-none font-medium tabular-nums">{mark.kind === 'stars' ? mark.rating : mark.grade}</span>
            {mark.kind === 'stars' && (
              <span
                aria-hidden
                className="relative inline-block h-3.75 w-21 bg-[linear-gradient(90deg,#f5a623_var(--fill),color-mix(in_oklab,var(--muted-foreground)_30%,transparent)_var(--fill))] [mask:var(--star-mask)_repeat-x_0_0/16.8px_15px]"
                style={{ '--fill': `${(Number(mark.rating) / 5) * 100}%`, '--star-mask': STAR_MASK_IMAGE } as CSSProperties}
              />
            )}
          </span>
          <span className="truncate text-sm leading-tight text-muted-foreground tabular-nums">
            {mark.kind === 'stars' ? `${mark.count} reviews on ${mark.platform}` : `Rating on ${mark.platform}`}
          </span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </li>
    )
  }

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
          {/* eslint-disable-next-line heavy-font-weight/no-heavy-font-weight -- copies the BBB logotype */}
          {mark.platform === 'BBB' && <span className="text-[0.72em] font-black text-[#00567a]">BBB</span>}
        </span>
        <span className="grid min-w-0 leading-tight">
          <span className="sr-only">{mark.platform}</span>
          {mark.kind === 'stars'
            ? (
                <>
                  <span className="flex items-center gap-[0.3em] font-semibold text-white tabular-nums @max-[30rem]/presentation:justify-center">
                    {mark.rating}
                    {/* eslint-disable-next-line theme-tokens/palette -- the rating star keeps the platforms' own gold, like the brand marks beside it */}
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
