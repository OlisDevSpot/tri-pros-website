import type { MatchMode } from '@/features/omni-search/lib/split-match'

import { splitMatch } from '@/features/omni-search/lib/split-match'

interface Props {
  text: string
  term: string
  mode?: MatchMode
  className?: string
}

// Weight plus underline, so a match never leans on colour alone.
export function OmniMatchText({ text, term, mode, className }: Props) {
  return (
    <span className={className}>
      {splitMatch(text, term, mode).map(segment => segment.hit
        ? <mark key={segment.start} className="bg-transparent font-bold text-foreground underline decoration-primary/60 decoration-2 underline-offset-3">{segment.text}</mark>
        : <span key={segment.start}>{segment.text}</span>)}
    </span>
  )
}
