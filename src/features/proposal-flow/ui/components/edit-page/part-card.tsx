import type { ReactNode } from 'react'
import { ChevronLeftIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

interface Props {
  title: string
  hidden: boolean
  onBack?: () => void
  summary?: ReactNode
  contentClassName?: string
  children: ReactNode
}

// The Card never grows to fill its column: it hugs short content and only scrolls inside once the content is
// taller than the space left.
export function PartCard({ title, hidden, onBack, summary, contentClassName, children }: Props) {
  return (
    <Card className={cn('flex min-h-0 flex-[0_1_auto] flex-col shadow-none max-md:gap-1.5 max-md:py-3', hidden && 'hidden')}>
      <CardHeader>
        <div className="flex items-center gap-1.5 md:block">
          {onBack && (
            <Button type="button" variant="ghost" size="sm" className="shrink-0 rounded-none border-r border-border pr-2 max-md:h-10 md:hidden" onClick={onBack}>
              <ChevronLeftIcon />
              Back
            </Button>
          )}
          <CardTitle>{title}</CardTitle>
        </div>
        {summary && <CardDescription className="max-md:hidden">{summary}</CardDescription>}
      </CardHeader>
      <CardContent className={cn('min-h-0 overflow-y-auto overscroll-contain scrollbar-gutter-stable', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
