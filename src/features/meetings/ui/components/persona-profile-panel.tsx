'use client'

import type { CustomerPersonaProfile } from '@/shared/entities/customers/persona-profile-schema'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangleIcon,
  HeartIcon,
  HomeIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TargetIcon,
} from 'lucide-react'
import { PersonaProfileSection, SeverityBadge } from '@/features/meetings/ui/components/persona-profile-section'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet'
import { useTRPC } from '@/trpc/helpers'

interface PersonaProfilePanelProps {
  meetingId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

function FearsList({ fears }: { fears: CustomerPersonaProfile['fears'] }) {
  return (
    <>
      {fears.map((fear, i) => (
        <div className="rounded-md border border-border/50 bg-muted/30 p-2.5" key={i}>
          <div className="mb-1 flex items-center gap-1.5">
            <SeverityBadge value={fear.severity} />
            <span className="text-[10px] text-muted-foreground">{fear.emotionalDriver}</span>
          </div>
          <p className="text-xs leading-relaxed">{fear.fear}</p>
        </div>
      ))}
    </>
  )
}

function BenefitsList({ benefits }: { benefits: CustomerPersonaProfile['benefits'] }) {
  return (
    <>
      {benefits.map((benefit, i) => (
        <div className="rounded-md border border-border/50 bg-muted/30 p-2.5" key={i}>
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-primary">{benefit.tradeName}</span>
            <span className="text-[10px] text-muted-foreground">{benefit.category}</span>
          </div>
          <p className="text-xs font-medium">{benefit.headline}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{benefit.body}</p>
        </div>
      ))}
    </>
  )
}

function DecisionDriversList({ drivers }: { drivers: CustomerPersonaProfile['decisionDrivers'] }) {
  return (
    <>
      {drivers.map((driver, i) => (
        <div className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/30 p-2.5" key={i}>
          <SeverityBadge value={driver.weight} />
          <div className="flex-1">
            <p className="text-xs leading-relaxed">{driver.driver}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{driver.signal}</p>
          </div>
        </div>
      ))}
    </>
  )
}

function EmotionalLeversList({ levers }: { levers: CustomerPersonaProfile['emotionalLevers'] }) {
  return (
    <>
      {levers.map((lever, i) => (
        <div className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/30 p-2.5" key={i}>
          <SeverityBadge value={lever.relevance} />
          <div className="flex-1">
            <p className="text-xs font-medium">{lever.lever}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{lever.context}</p>
          </div>
        </div>
      ))}
    </>
  )
}

function HouseholdResonanceList({ items }: { items: CustomerPersonaProfile['householdResonance'] }) {
  return (
    <>
      {items.map((item, i) => (
        <div className="rounded-md border border-border/50 bg-muted/30 p-2.5" key={i}>
          <p className="text-xs font-medium">{item.factor}</p>
          <ul className="mt-1 space-y-0.5">
            {item.amplifiedConcerns.map((concern, j) => (
              <li className="text-[10px] leading-relaxed text-muted-foreground" key={j}>
                {concern}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

function RiskFactorsList({ risks }: { risks: CustomerPersonaProfile['riskFactors'] }) {
  return (
    <>
      {risks.map((risk, i) => (
        <div className="rounded-md border border-border/50 bg-muted/30 p-2.5" key={i}>
          <div className="mb-1 flex items-center gap-1.5">
            <SeverityBadge value={risk.severity} />
          </div>
          <p className="text-xs font-medium">{risk.risk}</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{risk.mitigation}</p>
        </div>
      ))}
    </>
  )
}

function ProfileContent({ profile }: { profile: CustomerPersonaProfile }) {
  const isEmpty = profile.fears.length === 0
    && profile.benefits.length === 0
    && profile.decisionDrivers.length === 0
    && profile.emotionalLevers.length === 0
    && profile.householdResonance.length === 0
    && profile.riskFactors.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
        <TargetIcon className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No profile data yet</p>
        <p className="text-xs text-muted-foreground/70">
          Fill in customer pain points and select trades to generate the persona profile.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PersonaProfileSection
        count={profile.riskFactors.length}
        defaultOpen
        icon={<AlertTriangleIcon className="size-4" />}
        title="Risk Factors"
      >
        <RiskFactorsList risks={profile.riskFactors} />
      </PersonaProfileSection>

      <PersonaProfileSection
        count={profile.fears.length}
        defaultOpen
        icon={<ShieldAlertIcon className="size-4" />}
        title="Fears"
      >
        <FearsList fears={profile.fears} />
      </PersonaProfileSection>

      <PersonaProfileSection
        count={profile.benefits.length}
        icon={<SparklesIcon className="size-4" />}
        title="Benefits to Highlight"
      >
        <BenefitsList benefits={profile.benefits} />
      </PersonaProfileSection>

      <PersonaProfileSection
        count={profile.decisionDrivers.length}
        icon={<TargetIcon className="size-4" />}
        title="Decision Drivers"
      >
        <DecisionDriversList drivers={profile.decisionDrivers} />
      </PersonaProfileSection>

      <PersonaProfileSection
        count={profile.emotionalLevers.length}
        icon={<HeartIcon className="size-4" />}
        title="Emotional Levers"
      >
        <EmotionalLeversList levers={profile.emotionalLevers} />
      </PersonaProfileSection>

      <PersonaProfileSection
        count={profile.householdResonance.length}
        icon={<HomeIcon className="size-4" />}
        title="Household Resonance"
      >
        <HouseholdResonanceList items={profile.householdResonance} />
      </PersonaProfileSection>
    </div>
  )
}

export function PersonaProfilePanel({ isOpen, meetingId, onOpenChange }: PersonaProfilePanelProps) {
  const trpc = useTRPC()

  const profileQuery = useQuery(
    trpc.meetingsRouter.getPersonaProfile.queryOptions(
      { meetingId },
      { enabled: isOpen },
    ),
  )

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b border-border/40 px-4 py-3">
          <SheetTitle className="text-base">Customer Persona Profile</SheetTitle>
        </SheetHeader>

        {profileQuery.isLoading && (
          <LoadingState description="Analyzing customer data..." title="Building profile" />
        )}

        {profileQuery.data && <ProfileContent profile={profileQuery.data} />}

        {profileQuery.isError && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Failed to load persona profile. Try again later.
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
