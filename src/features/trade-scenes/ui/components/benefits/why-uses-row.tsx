import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { BENEFITS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'

interface WhyUsesRowProps {
  label: string
  value: string
  tag: keyof typeof BENEFITS_COPY.why.tags
  portrait: boolean
}

// The calculator's "What it uses" row, without its Edit link: the costs are edited from the head, not from here.
export function WhyUsesRow({ label, value, tag, portrait }: WhyUsesRowProps) {
  return (
    <div data-why-uses-row className={cn('grid items-center gap-x-2.5 border-b border-dashed border-border py-1.75 text-sm', portrait ? 'grid-cols-[minmax(0,1fr)_auto] gap-y-0.75' : 'grid-cols-[minmax(0,1fr)_auto_7.5rem]')}>
      <span>{label}</span>
      <b className="text-right whitespace-nowrap tabular-nums">{value}</b>
      <span
        data-why-tag
        className={cn(
          CONTROLS_CLASSES.sourceTag,
          tag === 'typed' ? CONTROLS_CLASSES.sourceTagTyped : tag === 'working' ? toneClasses('attention').fill : 'border-transparent bg-muted text-muted-foreground',
          portrait ? 'col-start-1' : 'justify-self-end',
        )}
      >
        {BENEFITS_COPY.why.tags[tag]}
      </span>
    </div>
  )
}
