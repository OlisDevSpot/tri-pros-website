'use client'

import type { ActionItem } from '@/features/agent-dashboard/dal/server/get-action-queue'

import { formatDistanceToNow } from 'date-fns'

import { actionTierConfig } from '@/features/agent-dashboard/constants/action-tiers'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'

interface Props {
  item: ActionItem
  onSelect: (item: ActionItem) => void
}

const tierColorMap: Record<string, string> = {
  red: 'bg-red-500/10 text-red-500 border-red-500/20',
  orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  muted: 'bg-muted text-muted-foreground border-muted',
}

export function ActionCard({ item, onSelect }: Props) {
  const config = actionTierConfig[item.tier]
  const Icon = config.icon
  const colorClass = tierColorMap[config.color] ?? tierColorMap.muted

  const timeContext = item.lastViewedAt
    ? `Viewed ${formatDistanceToNow(new Date(item.lastViewedAt), { addSuffix: true })}`
    : item.sentAt
      ? `Sent ${formatDistanceToNow(new Date(item.sentAt), { addSuffix: true })}`
      : item.meetingDate
        ? `Meeting ${formatDistanceToNow(new Date(item.meetingDate), { addSuffix: true })}`
        : null

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50"
      onClick={() => onSelect(item)}
    >
      <CardContent className="flex items-center gap-4 py-3">
        <div className="shrink-0">
          <Icon size={20} className={tierColorMap[config.color]?.split(' ')[1] ?? 'text-muted-foreground'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{item.customerName}</span>
            <Badge variant="outline" className={colorClass}>
              {config.label}
            </Badge>
            {item.viewCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {item.viewCount}
                {' '}
                {item.viewCount === 1 ? 'view' : 'views'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{item.suggestedAction}</p>
          {timeContext && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">{timeContext}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" className="shrink-0">
          View
        </Button>
      </CardContent>
    </Card>
  )
}
