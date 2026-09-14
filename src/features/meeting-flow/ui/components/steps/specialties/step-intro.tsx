import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'

interface StepIntroProps {
  hasLead: boolean
}

export function StepIntro({ hasLead }: StepIntroProps) {
  return (
    <header className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold tracking-tight text-balance">{SPECIALTIES_COPY.heading}</h2>
      <p className="text-base text-muted-foreground">
        {hasLead ? SPECIALTIES_COPY.introWithLead : SPECIALTIES_COPY.introNoLead}
      </p>
    </header>
  )
}
