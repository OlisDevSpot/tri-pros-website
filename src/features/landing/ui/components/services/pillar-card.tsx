import Link from 'next/link'

import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface PillarCardProps {
  description: string
  href: string
  pillarType: 'energy' | 'luxury'
  title: string
  tradePreview: readonly string[]
}

const PILLAR_STYLES = {
  energy: {
    accent: 'from-blue-600/20 via-teal-500/15 to-blue-600/5',
    border: 'border-blue-500/30 hover:border-blue-500/50',
    cta: 'Explore Energy Solutions',
  },
  luxury: {
    accent: 'from-amber-600/20 via-orange-500/15 to-amber-600/5',
    border: 'border-amber-500/30 hover:border-amber-500/50',
    cta: 'Explore Renovation Services',
  },
}

export function PillarCard({ description, href, pillarType, title, tradePreview }: PillarCardProps) {
  const styles = PILLAR_STYLES[pillarType]

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col gap-6 rounded-xl border p-8 transition-all duration-300',
        'bg-linear-to-br hover:shadow-lg hover:scale-[1.01]',
        styles.accent,
        styles.border,
      )}
    >
      <h3 className="text-2xl font-bold text-foreground lg:text-3xl">
        {title}
      </h3>

      <p className="text-lg leading-relaxed text-muted-foreground">
        {description}
      </p>

      <div className="flex flex-wrap gap-2">
        {tradePreview.map(trade => (
          <Badge key={trade} variant="secondary" className="text-sm">
            {trade}
          </Badge>
        ))}
      </div>

      <div className="mt-auto pt-2">
        <Button variant="default" className="pointer-events-none">
          {styles.cta}
        </Button>
      </div>
    </Link>
  )
}
