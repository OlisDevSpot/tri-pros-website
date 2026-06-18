import type { InfoStep, StepProps } from '@/shared/domains/funnels/types'
import { Button } from '@/shared/components/ui/button'

export function InfoStepView({ content, advance }: StepProps<InfoStep>) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium">
        {content.scarcityLine}
      </span>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{content.headline}</h1>
      <p className="text-muted-foreground max-w-prose">{content.subhead}</p>
      <Button size="lg" onClick={advance}>{content.cta}</Button>
    </div>
  )
}
