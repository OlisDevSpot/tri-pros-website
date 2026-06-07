'use client'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { LeadDrawerActions } from '@/features/campaigns-admin/ui/components/leads/lead-drawer-actions'
import { LeadDrawerIdentity } from '@/features/campaigns-admin/ui/components/leads/lead-drawer-identity'
import { LeadStatusBadge } from '@/features/campaigns-admin/ui/components/leads/lead-status-badge'
import { Button } from '@/shared/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet'

interface LeadDrawerProps {
  onOpenChange: (open: boolean) => void
  onOpenProfile: (customerId: string) => void
  row: CampaignLeadRow | null
}

export function LeadDrawer({ onOpenChange, onOpenProfile, row }: LeadDrawerProps) {
  return (
    <Sheet onOpenChange={onOpenChange} open={row !== null}>
      <SheetContent className="flex w-full flex-col gap-5 sm:max-w-md" side="right">
        {row && (
          <>
            <SheetHeader className="gap-2">
              <div className="flex items-center gap-2">
                <SheetTitle>{row.name}</SheetTitle>
                <LeadStatusBadge status={row.status} />
              </div>
              <Button
                className="w-fit px-0"
                onClick={() => onOpenProfile(row.customerId)}
                size="sm"
                variant="link"
              >
                Open full profile ↗
              </Button>
            </SheetHeader>

            <LeadDrawerIdentity row={row} />

            {/*
              PHASE 2 (deferred): live CloudTalk activity block mounts here —
              <LeadDrawerCtActivity ctContactId={...} /> with its own
              loading/data/error states. Do NOT build until getLeadCtActivity ships.
            */}

            <div className="mt-auto border-t border-border pt-4">
              <LeadDrawerActions row={row} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
