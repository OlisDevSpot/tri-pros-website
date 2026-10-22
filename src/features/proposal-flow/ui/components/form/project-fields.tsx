import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { createEmptySowSection } from '@/shared/modules/proposals/core/lib/create-empty-sow-section'
import { AgreementNotesItem } from './agreement-notes-item'
import { SOWCollapsibleHeader } from './sow-collapsible-header'
import { SOWSection } from './sow-field'

interface Props {
  priceDisplayMode: PriceDisplayMode
}

export function ProjectFields({ priceDisplayMode }: Props) {
  const form = useFormContext<ProposalFormSchema>()

  const { fields, append, insert, remove } = useFieldArray({
    control: form.control,
    name: `project.data.sow`,
  })

  const [openSections, setOpenSections] = useState<Set<number>>(() => new Set([0]))

  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete SOW Section',
    message: 'Are you sure you want to delete this scope of work section? This action cannot be undone.',
  })

  const sowValues = useWatch({ control: form.control, name: 'project.data.sow' })

  async function handleDeleteSection(index: number) {
    const confirmed = await confirmDelete()
    if (!confirmed)
      return

    remove(index)
    setOpenSections((prev) => {
      const next = new Set<number>()
      for (const i of prev) {
        if (i < index)
          next.add(i)
        else if (i > index)
          next.add(i - 1)
      }
      return next
    })
  }

  function handleDuplicateSection(index: number) {
    const source = form.getValues(`project.data.sow.${index}`)
    const duplicate = {
      ...source,
      title: source.title ? `${source.title} (copy)` : '',
      financials: {
        sectionPrice: source.financials.sectionPrice,
        costLines: source.financials.costLines.map(line => ({ ...line, id: crypto.randomUUID() })),
        incentives: source.financials.incentives.map(inc => ({ ...inc, id: crypto.randomUUID() })),
      },
    }
    insert(index + 1, duplicate)
    setOpenSections((prev) => {
      const next = new Set<number>()
      for (const i of prev) {
        if (i <= index)
          next.add(i)
        else
          next.add(i + 1)
      }
      next.add(index + 1)
      return next
    })
  }

  function toggleSection(index: number) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      }
      else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <>
      <DeleteConfirmDialog />
      <div className="flex min-h-0 flex-[0_1_auto] flex-col gap-2">
        {fields.map((fieldOfArray, index) => {
          const isOpen = openSections.has(index)
          return (
            <Collapsible
              key={fieldOfArray.id}
              open={isOpen}
              onOpenChange={() => toggleSection(index)}
              // The floor grows over 200ms on CSS `ease`, which is COLLAPSE_TRANSITION's cubic-bezier(.25,.1,.25,1),
              // so the box and its body open together; change one and the box snaps ahead of its body.
              // The box keeps shrinking while its body exits: as flex-none it would jump to the body's full
              // height for the first frame of the collapse.
              className="flex min-h-0 flex-none flex-col overflow-hidden rounded-xl border border-border bg-card transition-[min-height] duration-200 ease-[ease] data-[state=open]:min-h-60 data-[state=open]:flex-[0_1_auto] has-[>[data-sow-body]]:flex-[0_1_auto] motion-reduce:transition-none"
            >
              <CollapsibleTrigger asChild>
                <div className="flex-none data-[state=open]:border-b">
                  <SOWCollapsibleHeader
                    isOpen={isOpen}
                    onDelete={(e) => {
                      e.stopPropagation()
                      handleDeleteSection(index)
                    }}
                    onDuplicate={(e) => {
                      e.stopPropagation()
                      handleDuplicateSection(index)
                    }}
                    onTitleChange={(title) => {
                      form.setValue(`project.data.sow.${index}.title`, title, { shouldDirty: true })
                    }}
                    priceDisplayMode={priceDisplayMode}
                    sow={sowValues[index] ?? fieldOfArray}
                  />
                </div>
              </CollapsibleTrigger>
              <AnimatedCollapsibleContent open={isOpen} className="flex min-h-0 flex-col" data-sow-body>
                {/* relative: Radix Select's hidden native <select> is absolute; without a positioned ancestor here it
                    escapes to <main>, makes main scrollable, and a focus then shifts the whole page. */}
                <div className="relative min-h-0 overflow-y-auto overscroll-contain">
                  <SOWSection
                    index={index}
                    priceDisplayMode={priceDisplayMode}
                    sowSnapshot={fieldOfArray}
                  />
                </div>
              </AnimatedCollapsibleContent>
            </Collapsible>
          )
        })}
        <AgreementNotesItem />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="flex-none self-start"
          onClick={() => {
            append(createEmptySowSection())
            setOpenSections(prev => new Set(prev).add(fields.length))
          }}
        >
          <PlusIcon />
        </Button>
      </div>
    </>
  )
}
