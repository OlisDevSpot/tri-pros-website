'use client'

import type { AgentSettingsProfile } from '@/features/agent-settings/types'
import type { AgentProfile } from '@/shared/entities/users/schemas'

import { formatTenure } from '@/features/agent-settings/lib/format-tenure'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'

interface ProfileHeaderCardProps {
  profile: AgentSettingsProfile
}

export function ProfileHeaderCard({ profile }: ProfileHeaderCardProps) {
  const initials = profile.name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()

  const tenure = formatTenure(profile.startDate)
  const headshotUrl = (profile.agentProfileJSON as AgentProfile | null)?.headshotUrl

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 pt-6 sm:flex-row sm:items-center sm:gap-6">
        <Avatar className="size-20 shrink-0 rounded-xl">
          <AvatarImage src={headshotUrl ?? profile.image ?? undefined} alt={profile.name} />
          <AvatarFallback className="rounded-xl text-2xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-3">
            <h2 className="text-2xl font-semibold">{profile.name}</h2>
            <Badge variant="secondary" className="capitalize">{profile.role}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
          {tenure && (
            <p className="text-sm text-muted-foreground">
              {'At Tri Pros for '}
              {tenure}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
