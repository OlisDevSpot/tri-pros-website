'use client'

import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { createRemodelRoiDefaults } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { useStoryUi } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { useRemodelRoi } from '@/features/calculators/remodel-roi-calculator/hooks/use-remodel-roi'
import { resolveRemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/lib/resolve-config'
import { buildStory } from '@/features/calculators/remodel-roi-calculator/lib/story/build-story'
import { remodelRoiFormSchema } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import { InputsPanel } from '@/features/calculators/remodel-roi-calculator/ui/components/inputs-panel'
import { AssumptionsSheet } from '@/features/calculators/remodel-roi-calculator/ui/components/story/assumptions-sheet'
import { ChapterInfoSheet } from '@/features/calculators/remodel-roi-calculator/ui/components/story/chapter-info-sheet'
import { StoryCanvas } from '@/features/calculators/remodel-roi-calculator/ui/components/story/story-canvas'
import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'
import { Form } from '@/shared/components/ui/form'
import { cn } from '@/shared/lib/utils'

interface Props {
  isBelowLg: boolean
}

export function RemodelRoiWorkspace({ isBelowLg }: Props) {
  const [config] = useState(resolveRemodelRoiConfig)
  const [lookAhead, setLookAhead] = useState<LookAheadYears>(config.defaultLookAheadYears)
  const form = useForm<RemodelRoiFormValues>({
    resolver: zodResolver(remodelRoiFormSchema),
    mode: 'onChange',
    defaultValues: createRemodelRoiDefaults(config),
  })
  const { collapsed, sheet, closeSheet } = useStoryUi()
  const projection = useRemodelRoi(form.control, config)
  const story = useMemo(() => buildStory({ projection, config, lookAhead }), [projection, config, lookAhead])

  return (
    <Form {...form}>
      <form
        className={cn('grid h-full min-h-0 grid-rows-[minmax(0,1fr)]', !isBelowLg && (collapsed ? 'grid-cols-[76px_minmax(0,1fr)]' : 'grid-cols-[340px_minmax(0,1fr)] min-[1400px]:grid-cols-[360px_minmax(0,1fr)]'))}
        noValidate
        onSubmit={event => event.preventDefault()}
      >
        {!isBelowLg && (
          <aside aria-label={STORY_COPY.inputs} className="min-h-0 border-r bg-card">
            <InputsPanel config={config} projection={projection} variant="docked" />
          </aside>
        )}
        <StoryCanvas lookAhead={lookAhead} onLookAheadChange={setLookAhead} projection={projection} showInputsButton={isBelowLg} story={story} />
        {isBelowLg && (
          <ResponsiveSheet drawerClassName="max-h-[85vh]" hideTitle onOpenChange={open => !open && closeSheet()} open={sheet?.kind === 'inputs'} title={STORY_COPY.inputs}>
            <InputsPanel config={config} projection={projection} variant="sheet" />
          </ResponsiveSheet>
        )}
        <ChapterInfoSheet story={story} />
        <AssumptionsSheet config={config} projection={projection} />
      </form>
    </Form>
  )
}
