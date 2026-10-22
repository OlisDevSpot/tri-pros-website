import type { ReactNode } from 'react'
import { ChevronLeftIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

interface Props {
  title: string
  hidden: boolean
  onBack?: () => void
  contentClassName?: string
  children: ReactNode
}

// The Card never grows to fill its column: it hugs short content and only scrolls inside once the content is
// taller than the space left.
export function PartCard({ title, hidden, onBack, contentClassName, children }: Props) {
  return (
    <Card className={cn('flex min-h-0 flex-[0_1_auto] flex-col', hidden && 'hidden')}>
      <CardHeader>
        {onBack && (
          <Button type="button" variant="ghost" size="sm" className="w-fit md:hidden" onClick={onBack}>
            <ChevronLeftIcon />
            All parts
          </Button>
        )}
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className={cn('min-h-0 overflow-y-auto overscroll-contain', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
