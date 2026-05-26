'use client'

import type { EnvelopeDocumentId } from '@/shared/constants/enums'
import { FileText } from 'lucide-react'
import { ENVELOPE_DOCUMENT_LABELS } from '@/shared/services/providers/zoho-sign/lib/documents/labels'
import { EditableAgeField } from './editable-age-field'

interface EnvelopeConfigurationSectionProps {
  proposalId: string
  customerAge: number | null
  envelopeDocumentIds: readonly EnvelopeDocumentId[] | null
  ageLocked: boolean
  ageLockReason?: string
}

/**
 * Always-visible summary of the envelope's saved configuration: customer
 * age (with inline edit affordance) and the document selection. Sits
 * above the state-specific content in the envelope card.
 */
export function EnvelopeConfigurationSection({
  proposalId,
  customerAge,
  envelopeDocumentIds,
  ageLocked,
  ageLockReason,
}: EnvelopeConfigurationSectionProps) {
  const docs = envelopeDocumentIds ?? []
  const docCount = docs.length

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr] sm:gap-x-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Age
          </span>
          <EditableAgeField
            proposalId={proposalId}
            value={customerAge}
            locked={ageLocked}
            lockReason={ageLockReason}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {docCount > 0 ? `Documents (${docCount})` : 'Documents'}
          </span>
          {docCount === 0 && (
            <span className="text-sm text-muted-foreground">No documents selected</span>
          )}
          {docCount > 0 && (
            <ul className="flex flex-col gap-0.5">
              {docs.map(id => (
                <li key={id} className="flex items-center gap-1.5 text-sm">
                  <FileText className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{ENVELOPE_DOCUMENT_LABELS[id] ?? id}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
