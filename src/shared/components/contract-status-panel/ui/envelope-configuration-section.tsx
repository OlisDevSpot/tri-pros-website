'use client'

import type { EnvelopeDocumentId } from '@/shared/constants/enums'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { CUSTOMER_AGE_MAX, CUSTOMER_AGE_MIN } from '@/shared/entities/customers/lib/constants'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

const AGE_DEBOUNCE_MS = 350

interface EnvelopeConfigurationSectionProps {
  proposalId: string
  token?: string
  locked: boolean
  lockReason?: string
}

function parseAge(input: string): number | null {
  const parsed = Number.parseInt(input, 10)
  if (Number.isNaN(parsed) || parsed < CUSTOMER_AGE_MIN || parsed > CUSTOMER_AGE_MAX) {
    return null
  }
  return parsed
}

/**
 * Always-visible agreement-context editor.
 *
 * Renders the customer age as a plain `<input type="number">` (debounced
 * 350ms before persisting) and the registry-evaluated docs as Switch
 * toggles — required ones forced on + disabled, optional ones free.
 * All inputs `disabled` when an envelope of any status exists.
 *
 * Single mutation surface: `applyEnvelopeContext` accepts either or both
 * inputs and the server reconciles the doc selection against the new age.
 *
 * see `src/shared/entities/proposals/DOCS.md#agreement-context-as-coherent-unit`
 */
export function EnvelopeConfigurationSection({
  proposalId,
  token,
  locked,
  lockReason,
}: EnvelopeConfigurationSectionProps) {
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()

  const contextQuery = useQuery(
    trpc.proposalsRouter.contracts.evaluateEnvelopeContext.queryOptions({
      id: proposalId,
      token,
    }),
  )

  const applyContext = useMutation(
    trpc.proposalsRouter.contracts.applyEnvelopeContext.mutationOptions({
      onSuccess: () => invalidateProposal({ proposalId }),
      onError: err => toast.error(err.message || 'Failed to update agreement context'),
    }),
  )

  const data = contextQuery.data
  const serverAge = data?.customerAge ?? null
  const docs = data?.docs ?? []
  const savedSelection = data?.envelopeDocumentIds ?? []
  const savedSet = new Set(savedSelection)

  // Local input mirrors the server value but lets the user type freely.
  const [ageInput, setAgeInput] = useState<string>(serverAge != null ? String(serverAge) : '')
  const debouncedAgeInput = useDebounce(ageInput, AGE_DEBOUNCE_MS)

  // Re-sync local input when the server-known age changes from elsewhere
  // (e.g., another tab persisted a new value). Server is source of truth.
  useEffect(() => {
    setAgeInput(serverAge != null ? String(serverAge) : '')
  }, [serverAge])

  // Fire the mutation when the *debounced* input differs from the
  // server-known age. The parse+bounds check guards against firing on
  // partially-typed numbers ("6" before "65").
  useEffect(() => {
    const parsed = parseAge(debouncedAgeInput)
    if (parsed == null || parsed === serverAge) {
      return
    }
    applyContext.mutate({ id: proposalId, token, age: parsed })
    // applyContext.mutate is stable across renders; intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAgeInput, serverAge, proposalId, token])

  function handleDocToggle(docId: EnvelopeDocumentId, isOn: boolean) {
    const next = new Set(savedSelection)
    if (isOn) {
      next.add(docId)
    }
    else {
      next.delete(docId)
    }
    applyContext.mutate({
      id: proposalId,
      token,
      envelopeDocumentIds: Array.from(next),
    })
  }

  const isAgeSaving = applyContext.isPending && applyContext.variables?.age != null
  const hasAge = serverAge != null

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-3.5">
      {/* Age */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`envelope-age-${proposalId}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Customer Age
          </Label>
          {isAgeSaving && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Saving…
            </span>
          )}
        </div>
        <Input
          id={`envelope-age-${proposalId}`}
          type="number"
          min={CUSTOMER_AGE_MIN}
          max={CUSTOMER_AGE_MAX}
          value={ageInput}
          onChange={e => setAgeInput(e.target.value)}
          disabled={locked || contextQuery.isLoading}
          aria-describedby={locked ? `envelope-age-${proposalId}-lock` : undefined}
          className="h-9 max-w-35"
          placeholder="Enter age"
        />
        {locked && lockReason && (
          <p id={`envelope-age-${proposalId}-lock`} className="text-xs text-muted-foreground">
            {lockReason}
          </p>
        )}
      </div>

      {/* Documents */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Documents
        </span>
        {!hasAge && (
          <p className="text-sm text-muted-foreground">
            Enter the customer's age above to see available documents.
          </p>
        )}
        {hasAge && docs.length === 0 && (
          <p className="text-sm text-muted-foreground">No documents available for this configuration.</p>
        )}
        {hasAge && docs.length > 0 && (
          <ul className="flex flex-col gap-2">
            {docs.map((doc) => {
              const isRequired = doc.status === 'required'
              const checked = isRequired || savedSet.has(doc.id)
              const inputId = `envelope-doc-${proposalId}-${doc.id}`
              return (
                <li key={doc.id} className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor={inputId}
                    className={cn(
                      'flex-1 text-sm leading-tight cursor-pointer',
                      (locked || isRequired) && 'cursor-default',
                    )}
                  >
                    {doc.label}
                    {isRequired && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">(required)</span>
                    )}
                  </Label>
                  <Switch
                    id={inputId}
                    checked={checked}
                    disabled={locked || isRequired || applyContext.isPending}
                    onCheckedChange={(v) => {
                      if (isRequired) {
                        return
                      }
                      handleDocToggle(doc.id, v)
                    }}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
