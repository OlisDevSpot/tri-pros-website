'use client'

import { useQuery } from '@tanstack/react-query'

import { ProfileHeaderCard } from '@/features/agent-settings/ui/components/profile-header-card'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useTRPC } from '@/trpc/helpers'

export function SettingsView() {
  const trpc = useTRPC()
  const { data: profile, isLoading } = useQuery(trpc.agentSettingsRouter.getProfile.queryOptions())

  if (isLoading) {
    return <LoadingState title="Loading settings…" />
  }

  if (!profile) {
    return null
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 pb-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your profile, preferences, and account settings.</p>
        </div>
        <ProfileHeaderCard profile={profile} />
      </div>
    </div>
  )
}
