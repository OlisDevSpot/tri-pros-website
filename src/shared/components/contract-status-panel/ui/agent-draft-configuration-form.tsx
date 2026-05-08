'use client'

import type { EnvelopeDocumentId } from '@/shared/constants/enums'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { Check, Loader2, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Switch } from '@/shared/components/ui/switch'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useTRPC } from '@/trpc/helpers'

interface AgentDraftConfigurationFormProps {
  proposalId: string
  initialAge: number | null
}

/**
 * Pre-send draft configuration: customer age + envelope document
 * selection persisted atomically via configureDraftEnvelope. Required
 * docs render as static rows; optional docs as Switches. Once submitted,
 * the send-proposal flow picks the registry path and assembles the
 * multi-template envelope.
 */
export function AgentDraftConfigurationForm({ proposalId, initialAge }: AgentDraftConfigurationFormProps) {
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()

  const [ageInput, setAgeInput] = useState(initialAge != null ? String(initialAge) : '')
  const [optionalSelected, setOptionalSelected] = useState<Set<EnvelopeDocumentId>>(() => new Set())

  const parsedAge = Number.parseInt(ageInput, 10)
  const isAgeValid = !Number.isNaN(parsedAge) && parsedAge >= 18 && parsedAge <= 120

  // Debounce so each keystroke doesn't fire a server roundtrip through
  // getProposal's joins + subquery — only the senior-status flip at 65
  // changes the doc list.
  const debouncedAge = useDebounce(isAgeValid ? parsedAge : undefined, 250)

  const evaluation = useQuery(
    trpc.proposalsRouter.contracts.evaluateEnvelopeDocs.queryOptions(
      { proposalId, ageOverride: debouncedAge },
      { enabled: debouncedAge != null, placeholderData: keepPreviousData },
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

  const docs = evaluation.data?.docs ?? []
  const requiredDocs = docs.filter(d => d.status === 'required')
  const optionalDocs = docs.filter(d => d.status === 'optional')
  const showDocs = isAgeValid && evaluation.data != null
  const isPending = submit.isPending

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

  function handleSubmit() {
    if (!isAgeValid || !evaluation.data) {
      return
    }
    // Filter optionalSelected against current optionalDocs — drops any
    // ids that became forbidden when senior status flipped.
    const allowedOptional = new Set(optionalDocs.map(d => d.id))
    const selection: EnvelopeDocumentId[] = [
      ...requiredDocs.map(d => d.id),
      ...[...optionalSelected].filter(id => allowedOptional.has(id)),
    ]
    submit.mutate({ proposalId, age: parsedAge, envelopeDocumentIds: selection })
  }

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
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-primary" />
                    <span className="text-sm">{doc.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Required</span>
                </div>
              ))}
              {optionalDocs.map(doc => (
                <label
                  key={doc.id}
                  htmlFor={`opt-${doc.id}`}
                  className="flex cursor-pointer items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 hover:border-border"
                >
                  <span className="text-sm">{doc.label}</span>
                  <Switch
                    id={`opt-${doc.id}`}
                    checked={optionalSelected.has(doc.id)}
                    disabled={isPending}
                    onCheckedChange={checked => toggleOptional(doc.id, checked)}
                  />
                </label>
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
