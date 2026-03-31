'use client'

import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'

import { dashboardStepParser } from '@/features/agent-dashboard/lib/url-parsers'
import { AdminSection } from '@/features/agent-settings/ui/components/admin-section'
import { AppSettingsSection } from '@/features/agent-settings/ui/components/app-settings-section'
import { CompanyInfoSection } from '@/features/agent-settings/ui/components/company-info-section'
import { CustomerBrandSection } from '@/features/agent-settings/ui/components/customer-brand-section'
import { HeadshotUpload } from '@/features/agent-settings/ui/components/headshot-upload'
import { IdentityContactSection } from '@/features/agent-settings/ui/components/identity-contact-section'
import { ProfileHeaderCard } from '@/features/agent-settings/ui/components/profile-header-card'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useTRPC } from '@/trpc/helpers'

export function SettingsView() {
  const trpc = useTRPC()
  const [, setStep] = useQueryState('step', dashboardStepParser)
  const { data: profile, isLoading } = useQuery(trpc.agentSettingsRouter.getProfile.queryOptions())

  if (isLoading) {
    return <LoadingState title="Loading settings..." />
  }

  if (!profile) {
    return null
  }

  const isSuperAdmin = profile.role === 'super-admin'

  function handleNavigate(step: string) {
    void setStep(step as Parameters<typeof setStep>[0])
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 pb-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your profile, preferences, and account settings.</p>
        </div>
        <ProfileHeaderCard profile={profile} />
        <HeadshotUpload profile={profile} />
        <div className="grid gap-6 lg:grid-cols-2">
          <IdentityContactSection profile={profile} />
          <AppSettingsSection />
          <CustomerBrandSection profile={profile} />
          <CompanyInfoSection />
        </div>
        {isSuperAdmin && <AdminSection onNavigate={handleNavigate} />}
      </div>
    </div>
  )
}
