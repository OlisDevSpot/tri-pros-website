'use client'

import type { ActionItem } from '@/features/agent-dashboard/dal/server/get-action-queue'

import { formatDistanceToNow } from 'date-fns'
import { ExternalLinkIcon, MailIcon, PhoneIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { actionTierConfig } from '@/features/agent-dashboard/constants/action-tiers'
import { followUpCadence } from '@/features/agent-dashboard/constants/follow-up-cadence'
import { tierColorMap } from '@/features/agent-dashboard/constants/tier-color-map'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet'
import { ROOTS } from '@/shared/config/roots'
import { formatAsPhoneNumber } from '@/shared/lib/formatters'

interface Props {
  item: ActionItem | null
  onClose: () => void
}

export function ActionDetailSheet({ item, onClose }: Props) {
  const router = useRouter()

  if (!item) {
    return null
  }

  const config = actionTierConfig[item.tier]
  const Icon = config.icon
  const colorClass = tierColorMap[config.color] ?? tierColorMap.muted

  function handleCreateProposal() {
    router.push(ROOTS.dashboard.proposals.new())
    onClose()
  }

  return (
    <Sheet
      open={!!item}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Icon size={20} className={tierColorMap[config.color]?.split(' ')[1] ?? 'text-muted-foreground'} />
            <SheetTitle>{item.customerName}</SheetTitle>
          </div>
          <SheetDescription>{item.suggestedAction}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-4">
          {/* Tier Badge */}
          <Badge variant="outline" className={`${colorClass} w-fit`}>
            {config.label}
          </Badge>

          {/* Contact Info */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-medium">Contact</h4>
            {item.customerPhone && (
              <PhoneAction phone={item.customerPhone}>
                <Button variant="outline" size="sm" className="justify-start gap-2">
                  <PhoneIcon size={14} />
                  {formatAsPhoneNumber(item.customerPhone)}
                </Button>
              </PhoneAction>
            )}
            {item.customerEmail && (
              <EmailAction email={item.customerEmail}>
                <Button variant="outline" size="sm" className="justify-start gap-2">
                  <MailIcon size={14} />
                  {item.customerEmail}
                </Button>
              </EmailAction>
            )}
            {!item.customerPhone && !item.customerEmail && (
              <p className="text-sm text-muted-foreground">No contact info available</p>
            )}
          </div>

          {/* Proposal Details */}
          {item.type === 'proposal' && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium">Proposal Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Views</span>
                <span className="font-medium">{item.viewCount}</span>
                {item.lastViewedAt && (
                  <>
                    <span className="text-muted-foreground">Last viewed</span>
                    <span className="font-medium">
                      {formatDistanceToNow(new Date(item.lastViewedAt), { addSuffix: true })}
                    </span>
                  </>
                )}
                {item.sentAt && (
                  <>
                    <span className="text-muted-foreground">Sent</span>
                    <span className="font-medium">
                      {formatDistanceToNow(new Date(item.sentAt), { addSuffix: true })}
                    </span>
                  </>
                )}
                {item.trade && (
                  <>
                    <span className="text-muted-foreground">Trade</span>
                    <span className="font-medium">{item.trade}</span>
                  </>
                )}
                {item.daysSinceSent !== null && (
                  <>
                    <span className="text-muted-foreground">Days since sent</span>
                    <span className="font-medium">
                      {item.daysSinceSent}
                      {' '}
                      day
                      {item.daysSinceSent !== 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </div>
              <Button variant="outline" size="sm" className="mt-2 gap-2" asChild>
                <a href={ROOTS.dashboard.proposals.byId(item.proposalId!)}>
                  <ExternalLinkIcon size={14} />
                  View Proposal
                </a>
              </Button>
            </div>
          )}

          {/* Meeting Details */}
          {item.type === 'meeting' && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium">Meeting Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {item.program && (
                  <>
                    <span className="text-muted-foreground">Program</span>
                    <span className="font-medium">{item.program}</span>
                  </>
                )}
                {item.meetingDate && (
                  <>
                    <span className="text-muted-foreground">Meeting date</span>
                    <span className="font-medium">
                      {formatDistanceToNow(new Date(item.meetingDate), { addSuffix: true })}
                    </span>
                  </>
                )}
              </div>
              <Button
                variant="default"
                size="sm"
                className="mt-2"
                onClick={handleCreateProposal}
              >
                Create Proposal
              </Button>
            </div>
          )}

          {/* Follow-up Cadence Reference */}
          {item.type === 'proposal' && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium">Follow-Up Cadence</h4>
              <div className="flex flex-col gap-1.5">
                {followUpCadence.map(step => (
                  <div
                    key={step.day}
                    className={`text-sm px-2 py-1.5 rounded-md ${
                      item.cadenceDay === step.day
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <span className="font-medium">{step.label}</span>
                    {': '}
                    {step.action}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
