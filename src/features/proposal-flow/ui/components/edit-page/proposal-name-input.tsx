'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { Proposal } from '@/shared/db/schema'
import { useFormContext } from 'react-hook-form'
import { Badge } from '@/shared/components/ui/badge'
import { FormControl, FormField, FormItem, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'
import { PROPOSAL_ROW_STYLES } from '@/shared/modules/proposals/core/constants/proposal-row-styles'

interface Props {
  status: Proposal['status']
}

export function ProposalNameInput({ status }: Props) {
  const form = useFormContext<ProposalFormSchema>()

  return (
    <FormField
      name="project.data.label"
      control={form.control}
      render={({ field }) => (
        <FormItem className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            {/* The hidden copy sizes the shared grid cell to the text in every browser; `field-sizing` is uneven in Safari. */}
            <div className="inline-grid min-w-0 max-w-full grid-cols-[minmax(0,auto)]">
              <span
                aria-hidden
                className="invisible h-9 overflow-hidden whitespace-pre border px-3 py-1 text-base font-semibold [grid-area:1/1]"
              >
                {field.value || 'Project Name'}
              </span>
              <FormControl>
                <Input
                  {...field}
                  size={1}
                  placeholder="Project Name"
                  aria-label="Project Name"
                  className="h-9 border-transparent bg-transparent text-base font-semibold shadow-none [grid-area:1/1] hover:border-input focus-visible:border-ring md:text-base"
                />
              </FormControl>
            </div>
            <Badge variant="outline" className={cn('hidden shrink-0 text-xs capitalize md:inline-flex', PROPOSAL_ROW_STYLES[status].textClass)}>
              {status}
            </Badge>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
