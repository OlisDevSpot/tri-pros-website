import type { AnswerValue, CardSelectContent } from '@/shared/domains/funnels/types'
import { ArrowRight, Check } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

/**
 * The funnel's first question, rendered INSIDE the hero in place of the old
 * "See if you qualify" CTA — so a first-time visitor answers Q1 (homeowner)
 * immediately, no click to "start".
 *
 * It wears the funnel's one DARK MOMENT: the brand-blue→navy "spotlight" panel
 * (`--q1-*` tokens) with glass tiles, a highlighted dark section that lifts the
 * question off the bright hero plate. This is the COMPACT form of that panel —
 * a couple of pills, not the full card grid — sized for the hero.
 *
 * Picking IS proceeding: tapping any tile always sets the value and advances —
 * a first answer or a revisit reached via Back, and re-tapping the current
 * selection too (tap = confirm + proceed). Once answered, an explicit Continue
 * also shows (mirrors the shell's Next) so a Back-revisiting visitor can move on
 * without re-tapping; an unanswered Q1 shows the "60 seconds" reassurance.
 */
export function FunnelHeroEntry({ content, value, isAnswered, setValue, advance }: {
  content: CardSelectContent
  value: AnswerValue
  isAnswered: boolean
  setValue: (answer: string) => void
  advance: () => void
}) {
  function handleSelect(optionId: string) {
    setValue(optionId)
    advance()
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3.5 rounded-2xl bg-linear-to-b from-(--q1-from) to-(--q1-to) p-5 shadow-(--shadow-hero) ring-1 ring-white/10">
      <p className="text-center text-lg font-semibold text-white">{content.title}</p>
      <div className="grid w-full grid-cols-2 gap-3">
        {content.options.map((option) => {
          const selected = value === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.id)}
              className={cn(
                'touch-manipulation rounded-xl border-2 px-4 py-3.5 text-base font-semibold text-white shadow-sm backdrop-blur-md transition-colors',
                selected
                  ? 'border-(--q1-ring) bg-(--q1-tile-selected)'
                  : 'border-white/15 bg-(--q1-tile) hover:border-white/40',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {isAnswered
        ? (
            <Button size="lg" onClick={advance} className="@xs:w-auto mt-1 w-full bg-white text-(--q1-to) hover:bg-white/90">
              Continue
              <ArrowRight className="size-4" />
            </Button>
          )
        : (
            <p className="flex items-center justify-center gap-1.5 text-sm text-white/65">
              <Check className="size-3.5" aria-hidden="true" />
              Takes 60 seconds
            </p>
          )}
    </div>
  )
}
