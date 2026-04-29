'use client'

import type { EnvelopeDocumentId } from '@/shared/constants/enums'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { Check, Loader2, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Switch } from '@/shared/components/ui/switch'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface AgentDraftConfigurationFormProps {
  proposalId: string
  /** Customer's currently saved age. Pre-fills the input if present. */
  initialAge: number | null
}

/**
 * Pre-send draft configuration for the agent. Two stages, single submit:
 *
 *   1. Customer age — drives senior-vs-non-senior agreement variant
 *      and reveals the document selector once valid.
 *   2. Document selector — required docs render as static check rows
 *      (cannot be unchecked), optional docs render as Switches that
 *      default off. List comes from the registry-driven evaluator.
 *
 * Submitting fires `configureDraftEnvelope`, which atomically persists
 * both the age and the selection. The send-proposal flow then picks up
 * the registry path and assembles the envelope from the chosen docs.
 */
export function AgentDraftConfigurationForm({ proposalId, initialAge }: AgentDraftConfigurationFormProps) {
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()

  const [ageInput, setAgeInput] = useState(initialAge != null ? String(initialAge) : '')
  // Raw selection — may contain ids that are no longer applicable when
  // senior status flips. The derived `validSelected` below intersects
  // against the current evaluation, so stale entries never leak into
  // either the rendered switches or the submitted payload.
  const [optionalSelected, setOptionalSelected] = useState<Set<EnvelopeDocumentId>>(() => new Set())

  const parsedAge = Number.parseInt(ageInput, 10)
  const isAgeValid = !Number.isNaN(parsedAge) && parsedAge >= 18 && parsedAge <= 120

  const evaluation = useQuery(
    trpc.proposalsRouter.contracts.evaluateEnvelopeDocs.queryOptions(
      { proposalId, ageOverride: isAgeValid ? parsedAge : undefined },
      { enabled: isAgeValid, placeholderData: keepPreviousData },
    ),
  )

  const submit = useMutation(
    trpc.proposalsRouter.contracts.configureDraftEnvelope.mutationOptions({
      onSuccess: () => {
        invalidateProposal()
        toast.success('Draft configured')
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to configure draft')
      },
    }),
  )

  const requiredDocs = useMemo(
    () => evaluation.data?.docs.filter(d => d.status === 'required') ?? [],
    [evaluation.data],
  )
  const optionalDocs = useMemo(
    () => evaluation.data?.docs.filter(d => d.status === 'optional') ?? [],
    [evaluation.data],
  )

  // Derived effective selection — drops any ids that are no longer
  // optional under the current evaluation (e.g. agent edited age, the
  // senior branch flipped, a doc switched between optional/forbidden).
  const validSelected = useMemo<Set<EnvelopeDocumentId>>(() => {
    const allowed = new Set(optionalDocs.map(d => d.id))
    const next = new Set<EnvelopeDocumentId>()
    for (const id of optionalSelected) {
      if (allowed.has(id)) {
        next.add(id)
      }
    }
    return next
  }, [optionalSelected, optionalDocs])

  function handleSubmit() {
    if (!isAgeValid || !evaluation.data) {
      return
    }
    const selection = [
      ...requiredDocs.map(d => d.id),
      ...optionalDocs.filter(d => validSelected.has(d.id)).map(d => d.id),
    ]
    submit.mutate({ proposalId, age: parsedAge, envelopeDocumentIds: selection })
  }

  function toggleOptional(id: EnvelopeDocumentId, checked: boolean) {
    setOptionalSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      }
      else {
        next.delete(id)
      }
      return next
    })
  }

  const showDocs = isAgeValid && evaluation.data != null
  const isPending = submit.isPending

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 rounded-lg border border-primary/20 bg-primary/5 p-4"
    >
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium text-foreground">Configure agreement before sending</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Confirm the customer's age and pick which documents this envelope should
            include. Senior customers (65+) get an additional 5-day cancellation window
            and the senior-citizen acknowledgement per CSLB rules.
          </p>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div className="w-24">
          <label htmlFor="customer-age" className="mb-1 block text-xs font-medium text-muted-foreground">
            Age
          </label>
          <Input
            id="customer-age"
            type="number"
            min={18}
            max={120}
            placeholder="e.g. 42"
            value={ageInput}
            onChange={e => setAgeInput(e.target.value)}
            disabled={isPending}
          />
        </div>
        {isAgeValid && evaluation.data?.isSenior && (
          <p className="pb-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            Senior — extended cancellation rights apply
          </p>
        )}
      </div>

      {showDocs && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
        >
          <div className="border-t border-primary/15 pt-4">
            <p className="text-xs font-medium text-muted-foreground">Documents in this envelope</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {requiredDocs.map(doc => (
                <RequiredRow key={doc.id} label={doc.label} />
              ))}
              {optionalDocs.map(doc => (
                <OptionalRow
                  key={doc.id}
                  id={doc.id}
                  label={doc.label}
                  checked={validSelected.has(doc.id)}
                  disabled={isPending}
                  onChange={checked => toggleOptional(doc.id, checked)}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!showDocs || isPending}
        size="sm"
        className="self-end"
      >
        {isPending
          ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            )
          : 'Confirm & Continue'}
      </Button>
    </motion.div>
  )
}

function RequiredRow({ label }: { label: string }) {
  return (
    <div className={cn(
      'flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2',
    )}
    >
      <div className="flex items-center gap-2">
        <Check className="size-4 text-primary" />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-xs text-muted-foreground">Required</span>
    </div>
  )
}

function OptionalRow({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: EnvelopeDocumentId
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={`opt-${id}`}
      className="flex cursor-pointer items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 hover:border-border"
    >
      <span className="text-sm">{label}</span>
      <Switch
        id={`opt-${id}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </label>
  )
}
