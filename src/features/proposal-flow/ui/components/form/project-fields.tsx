import type { SowSectionTab } from '@/features/proposal-flow/constants/sow-section-tabs'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import { useEffect, useRef, useState } from 'react'
import { useFieldArray, useFormContext, useFormState, useWatch } from 'react-hook-form'
import { useEditLoading } from '@/features/proposal-flow/contexts/edit-loading-context'
import { firstSowErrorTarget } from '@/features/proposal-flow/lib/sow-error-target'
import {
  insertIntoOpenSet,
  insertIntoTabMap,
  openSection,
  removeFromOpenSet,
  removeFromTabMap,
  toggleSection,
} from '@/features/proposal-flow/lib/sow-open-sections'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'
import { createEmptySowSection } from '@/shared/modules/proposals/core/lib/create-empty-sow-section'
import { AgreementNotesItem } from './agreement-notes-item'
import { SowAddRow } from './sow-add-row'
import { SOWCollapsibleHeader } from './sow-collapsible-header'
import { SOWSection } from './sow-field'

interface Props {
  priceDisplayMode: PriceDisplayMode
  // Whether the Scope of Work part is the one on screen; the create page leaves it unset.
  active?: boolean
}

export function ProjectFields({ priceDisplayMode, active }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const isMobile = useIsMobile()
  const loading = useEditLoading()

  const { fields, append, insert, remove } = useFieldArray({
    control: form.control,
    name: `project.data.sow`,
  })

  const [openSections, setOpenSections] = useState<Set<number>>(() => new Set([0]))
  const [sectionTabs, setSectionTabs] = useState<Map<number, SowSectionTab>>(() => new Map())

  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete SOW Section',
    message: 'Are you sure you want to delete this scope of work section? This action cannot be undone.',
  })
  const [RemoveNotesDialog, confirmRemoveNotes] = useConfirm({
    title: 'Remove agreement notes?',
    message: 'This clears the notes for this proposal.',
    confirmLabel: 'Remove',
  })

  const sowValues = useWatch({ control: form.control, name: 'project.data.sow' })
  const { disabled, defaultValues } = useFormState({ control: form.control })
  const { errors, submitCount } = useFormState({ control: form.control, name: 'project.data.sow' })

  // Follows each form reset (the loaded proposal), never typing: clearing every character keeps the item mounted
  // while the rep is still in it. Adjusted during render so no frame shows the reset values with the old choice.
  const savedNotes = !!defaultValues?.project?.data?.agreementNotes
  const [notes, setNotes] = useState(() => ({ source: defaultValues, visible: savedNotes, openOnMount: false }))
  if (notes.source !== defaultValues) {
    setNotes({ source: defaultValues, visible: savedNotes, openOnMount: false })
  }

  // Phone opens on the section list. Not in the initialiser: it also runs on the server, where every viewport is
  // the desktop one.
  useEffect(() => {
    if (isMobile) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- the viewport is only known after mount
      setOpenSections(new Set())
    }
  }, [isMobile])

  // The Part Cards are hidden, never unmounted, so leaving the part on phone has to close the drilled-in section.
  useEffect(() => {
    if (isMobile && active === false) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- follows the part leaving the screen
      setOpenSections(new Set())
    }
  }, [isMobile, active])

  const revealedSubmit = useRef(0)
  useEffect(() => {
    if (submitCount === revealedSubmit.current) {
      return
    }
    revealedSubmit.current = submitCount
    if (submitCount === 0) {
      return
    }
    // Only the SOW subtree: an earlier funding or general error would otherwise hide the SOW one.
    const target = firstSowErrorTarget({ project: { data: { sow: errors.project?.data?.sow } } })
    if (!target) {
      return
    }
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- follows a submit's errors
    setOpenSections(prev => openSection(prev, target.index, isMobile))
    const { tab } = target
    if (tab !== null) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- follows a submit's errors
      setSectionTabs(prev => new Map(prev).set(target.index, tab))
    }
  }, [submitCount, errors, isMobile])

  async function handleDeleteSection(index: number) {
    const confirmed = await confirmDelete()
    if (!confirmed)
      return

    remove(index)
    setOpenSections(prev => removeFromOpenSet(prev, index))
    setSectionTabs(prev => removeFromTabMap(prev, index))
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
    setOpenSections(prev => openSection(insertIntoOpenSet(prev, index + 1), index + 1, isMobile))
    setSectionTabs(prev => insertIntoTabMap(prev, index + 1))
  }

  function handleAddSection() {
    append(createEmptySowSection())
    setOpenSections(prev => openSection(prev, fields.length, isMobile))
  }

  async function handleRemoveNotes() {
    if (!(await confirmRemoveNotes()))
      return
    form.setValue('project.data.agreementNotes', '', { shouldDirty: true })
    setNotes(prev => ({ ...prev, visible: false }))
  }

  // Phone drill-in: while a section is open, everything else in the list steps aside.
  const stepAside = openSections.size > 0 ? 'max-md:hidden' : undefined

  // The section count is unknown until the proposal arrives: one closed header stands in, and the list grows
  // downward from it.
  if (loading) {
    return (
      <div className="flex flex-col gap-2 max-md:min-h-0 max-md:flex-[0_1_auto] md:flex-none">
        <div inert className="pointer-events-none flex flex-none flex-col rounded-xl border border-border bg-card md:overflow-hidden">
          <SOWCollapsibleHeader
            disabled
            isOpen={false}
            onDelete={() => {}}
            onDuplicate={() => {}}
            onTitleChange={() => {}}
            priceDisplayMode={priceDisplayMode}
            sow={sowValues[0] ?? createEmptySowSection()}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <DeleteConfirmDialog />
      <RemoveNotesDialog />
      <div className="flex flex-col gap-2 max-md:min-h-0 max-md:flex-[0_1_auto] md:flex-none">
        {fields.map((fieldOfArray, index) => {
          const isOpen = openSections.has(index)
          return (
            <Collapsible
              key={fieldOfArray.id}
              open={isOpen}
              onOpenChange={() => setOpenSections(prev => toggleSection(prev, index, isMobile))}
              // Phone: the floor grows over 200ms on CSS `ease`, which is COLLAPSE_TRANSITION's
              // cubic-bezier(.25,.1,.25,1), so the box and its body open together; change one and the box snaps
              // ahead of its body. The box keeps shrinking while its body exits: as flex-none it would jump to the
              // body's full height for the first frame of the collapse.
              // md and up: the item grows to its content and the Card scrolls; overflow stays visible so the open
              // header can stick to the Card's scroller.
              className={cn(
                'flex flex-col rounded-xl border border-border bg-card max-md:min-h-0 max-md:flex-none max-md:overflow-hidden max-md:transition-[min-height] max-md:duration-200 max-md:ease-[ease] max-md:data-[state=open]:min-h-60 max-md:data-[state=open]:flex-[0_1_auto] max-md:has-[>[data-sow-body]]:flex-[0_1_auto] motion-reduce:transition-none md:flex-none md:overflow-visible',
                !isOpen && stepAside,
              )}
            >
              <CollapsibleTrigger asChild>
                {/* bg-(--card), not bg-card: a third nested bg-card climbs a rung and would paint a lighter band
                    over its own item. The item can't clip at md (the sticky header needs it overflow-visible), so the
                    header clips its own hover band to the item's inner radius: the outer radius less the 1px border. */}
                <div className="flex-none data-[state=open]:border-b md:overflow-hidden md:rounded-[calc(var(--radius-xl)-1px)] md:data-[state=open]:sticky md:data-[state=open]:top-0 md:data-[state=open]:z-10 md:data-[state=open]:rounded-b-none md:data-[state=open]:bg-(--card)">
                  <SOWCollapsibleHeader
                    disabled={disabled}
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
              <AnimatedCollapsibleContent open={isOpen} className="flex flex-col max-md:min-h-0" data-sow-body>
                {/* relative: Radix Select's hidden native <select> is absolute; without a positioned ancestor here it
                    escapes to <main>, makes main scrollable, and a focus then shifts the whole page. */}
                <div className="relative max-md:min-h-0 max-md:overflow-y-auto max-md:overscroll-contain max-md:scrollbar-gutter-stable">
                  <SOWSection
                    index={index}
                    priceDisplayMode={priceDisplayMode}
                    sowSnapshot={fieldOfArray}
                    tab={sectionTabs.get(index) ?? 'description'}
                    onTabChange={tab => setSectionTabs(prev => new Map(prev).set(index, tab))}
                  />
                </div>
              </AnimatedCollapsibleContent>
            </Collapsible>
          )
        })}
        {notes.visible && (
          <AgreementNotesItem defaultOpen={notes.openOnMount} onRemove={handleRemoveNotes} className={stepAside} />
        )}
        <SowAddRow
          className={stepAside}
          disabled={disabled}
          showNotes={!notes.visible}
          onAddSection={handleAddSection}
          onAddNotes={() => setNotes(prev => ({ ...prev, visible: true, openOnMount: true }))}
        />
      </div>
    </>
  )
}
