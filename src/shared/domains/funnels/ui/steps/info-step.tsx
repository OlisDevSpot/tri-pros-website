import type { InfoStep, StepProps } from '@/shared/domains/funnels/types'
import { Button } from '@/shared/components/ui/button'

export function InfoStepView({ funnelContent, content, onAdvance }: StepProps<InfoStep>) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {funnelContent.scarcityLine
        ? (
            <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium">
              {funnelContent.scarcityLine}
            </span>
          )
        : null}
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{funnelContent.headline}</h1>
      {funnelContent.subhead
        ? <p className="text-muted-foreground max-w-prose">{funnelContent.subhead}</p>
        : null}
      <Button size="lg" onClick={onAdvance}>{content?.cta ?? 'Continue'}</Button>
    </div>
  )
}
