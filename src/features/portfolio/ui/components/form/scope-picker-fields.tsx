'use client'

import type { ProjectFormData } from '@/shared/entities/projects/schemas'
import { useQuery } from '@tanstack/react-query'
import { useFormContext } from 'react-hook-form'
import { ProjectScopePicker } from '@/shared/components/portfolio/project-scope-picker'
import { useTRPC } from '@/trpc/helpers'

export function ScopePickerFields() {
  const form = useFormContext<ProjectFormData>()
  const trpc = useTRPC()

  const { data: trades = [] } = useQuery(trpc.notionRouter.trades.getAll.queryOptions())
  const { data: scopes = [] } = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())

  const scopeIds = form.watch('scopeIds')

  const handleChange = (ids: number[]) => {
    form.setValue('scopeIds', ids, { shouldDirty: true })
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <ProjectScopePicker
          trades={trades}
          scopes={scopes}
          selectedScopeIds={scopeIds}
          onChange={handleChange}
        />
      </div>
    </section>
  )
}
