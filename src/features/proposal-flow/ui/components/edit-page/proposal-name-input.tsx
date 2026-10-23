'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { Proposal } from '@/shared/db/schema'
import { useFormContext } from 'react-hook-form'
import { useEditLoading } from '@/features/proposal-flow/contexts/edit-loading-context'
import { FormControl, FormField, FormItem, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'
import { LoadingValue } from './loading-value'
import { ProposalStatusChip } from './proposal-status-chip'

interface Props {
  status: Proposal['status'] | null
}

export function ProposalNameInput({ status }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const loading = useEditLoading()

  return (
    <FormField
      name="project.data.label"
      control={form.control}
      render={({ field }) => (
        <FormItem className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            {/* The hidden copy sizes the shared grid cell to the text in every browser; `field-sizing` is uneven in Safari.
                While loading it is shown instead, as the name's bar, under the empty input. */}
            <div className="inline-grid min-w-0 max-w-full grid-cols-[minmax(0,auto)]">
              <span
                aria-hidden
                className={cn(
                  'h-9 overflow-hidden whitespace-pre border px-3 py-1 text-base font-semibold [grid-area:1/1]',
                  loading ? 'border-transparent' : 'invisible',
                )}
              >
                <LoadingValue width={180}>{field.value || 'Project Name'}</LoadingValue>
              </span>
              <FormControl>
                <Input
                  {...field}
                  size={1}
                  data-own-bar
                  placeholder="Project Name"
                  aria-label="Project Name"
                  className="h-9 border-transparent bg-transparent text-base font-semibold shadow-none [grid-area:1/1] hover:border-input focus-visible:border-ring md:text-base"
                />
              </FormControl>
            </div>
            <ProposalStatusChip status={status} className="hidden md:inline-flex" />
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
