'use client'

import type { CampaignTab } from '@/features/campaigns-admin/constants/query-parsers'

import { useQueryState } from 'nuqs'

import { campaignTabParser } from '@/features/campaigns-admin/constants/query-parsers'
import { CampaignsLeadsView } from '@/features/campaigns-admin/ui/views/campaigns-leads-view'
import { CampaignsOverviewView } from '@/features/campaigns-admin/ui/views/campaigns-overview-view'
import { CampaignsSetupView } from '@/features/campaigns-admin/ui/views/campaigns-setup-view'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

export function CampaignsView() {
  const [tab, setTab] = useQueryState('tab', campaignTabParser)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
        <p className="text-xs text-muted-foreground">
          CloudTalk lead-conversion campaigns — enroll, curate, and inspect leads.
        </p>
      </header>

      <Tabs className="flex min-h-0 flex-1 flex-col" onValueChange={v => setTab(v as CampaignTab)} value={tab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>

        <TabsContent className="min-h-0 flex-1" value="overview"><CampaignsOverviewView /></TabsContent>
        <TabsContent className="flex min-h-0 flex-1 flex-col" value="leads"><CampaignsLeadsView /></TabsContent>
        <TabsContent className="flex min-h-0 flex-1 flex-col" value="setup"><CampaignsSetupView /></TabsContent>
      </Tabs>
    </div>
  )
}
