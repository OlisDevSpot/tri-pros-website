'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext, useWatch } from 'react-hook-form'
import { FORM_PARTS } from '@/features/proposal-flow/constants/form-parts'
import { useFormPart } from '@/features/proposal-flow/hooks/use-form-part'
import { FundingFields } from '@/features/proposal-flow/ui/components/form/funding-fields'
import { GeneralFields } from '@/features/proposal-flow/ui/components/form/general-fields'
import { ProjectFields } from '@/features/proposal-flow/ui/components/form/project-fields'
import { ProposalMediaManager } from '@/features/proposal-flow/ui/components/form/proposal-media-manager'
import { cn } from '@/shared/lib/utils'
import { PartCard } from './part-card'
import { PartList } from './part-list'
import { PartRail } from './part-rail'
import { PartStrip } from './part-strip'

interface Props {
  proposalId: string
}

export function EditProposalBody({ proposalId }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const { part, activePart, setPart } = useFormPart()
  // The one value the parts take as a prop; it changes only through the settings switch, so typing never
  // re-renders the body.
  const pricingMode = useWatch({ control: form.control, name: 'priceDisplayMode' })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-(--gutter) lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <PartRail proposalId={proposalId} active={activePart} onSelect={setPart} />
      <PartStrip proposalId={proposalId} active={activePart} onSelect={setPart} />
      {part === null && <PartList proposalId={proposalId} onSelect={setPart} />}

      <div className={cn('flex min-h-0 flex-1 flex-col', part === null && 'hidden md:flex')}>
        {FORM_PARTS.map(({ id, label }) => (
          <PartCard
            key={id}
            title={label}
            hidden={id !== activePart}
            onBack={() => setPart(null)}
            contentClassName={id === 'sow' ? 'flex flex-col' : undefined}
          >
            {id === 'general' && <GeneralFields />}
            {id === 'sow' && <ProjectFields priceDisplayMode={pricingMode} />}
            {id === 'funding' && <FundingFields pricingMode={pricingMode} />}
            {id === 'files' && <ProposalMediaManager proposalId={proposalId} />}
          </PartCard>
        ))}
      </div>
    </div>
  )
}
