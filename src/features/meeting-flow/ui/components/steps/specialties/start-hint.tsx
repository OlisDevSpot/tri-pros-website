import { SparklesIcon } from 'lucide-react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { EmptyState } from '@/shared/components/states/empty-state'

/** Shown when the lead requested nothing. Replaced by lead panels when it did. */
export function StartHint() {
  return (
    <EmptyState className="h-auto" description={SPECIALTIES_COPY.start.body} title={SPECIALTIES_COPY.start.title}>
      <SparklesIcon aria-hidden className="mr-2 size-5 text-primary" />
    </EmptyState>
  )
}
