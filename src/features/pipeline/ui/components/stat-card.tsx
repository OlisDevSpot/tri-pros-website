import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/shared/components/ui/card'

interface Props {
  icon: LucideIcon
  label: string
  value: string | number
}

export function StatCard({ icon: Icon, label, value }: Props) {
  return (
    <Card>
      <CardContent className="py-3 px-4 flex items-center gap-3">
        <Icon size={18} className="text-muted-foreground shrink-0" />
        <div>
          <p className="text-lg font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
