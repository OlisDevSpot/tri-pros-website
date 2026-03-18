import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'

const UNIT_LABELS: Record<string, string> = {
  'sqft': 'per sqft',
  'unit': 'per unit',
  'space': 'per space',
  'linear ft': 'per linear ft',
  'bsq': 'per bsq',
}

interface ScopeCardProps {
  name: string
  unitOfPricing: string
}

export function ScopeCard({ name, unitOfPricing }: ScopeCardProps) {
  const unitLabel = UNIT_LABELS[unitOfPricing] ?? `per ${unitOfPricing}`

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <Badge variant="secondary" className="shrink-0 text-xs">
          {unitLabel}
        </Badge>
      </CardContent>
    </Card>
  )
}
