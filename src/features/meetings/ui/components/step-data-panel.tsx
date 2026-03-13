'use client'

import type { CollectionField, JsonbSection } from '@/features/meetings/types'
import type { Meeting } from '@/shared/db/schema'
import { ClipboardListIcon } from 'lucide-react'
import { StepDataContent } from '@/features/meetings/ui/components/step-data-content'
import { Button } from '@/shared/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'

interface StepDataPanelProps {
  fields: CollectionField[]
  meeting: Meeting
  onSave: (jsonbKey: JsonbSection, fieldId: string, value: string) => void
}

export function StepDataPanel({ fields, meeting, onSave }: StepDataPanelProps) {
  return (
    <>
      {/* Desktop: always-visible right panel */}
      <aside className="hidden h-full w-72 shrink-0 overflow-y-auto rounded-xl border border-border/50 bg-card/40 lg:flex lg:flex-col">
        <StepDataContent fields={fields} meeting={meeting} onSave={onSave} />
      </aside>

      {/* Mobile: bottom sheet trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            className="fixed right-4 bottom-20 z-40 gap-2 shadow-lg lg:hidden"
            size="sm"
            variant="outline"
          >
            <ClipboardListIcon className="size-4" />
            {fields.length > 0 ? 'Collect Data' : 'Notes'}
          </Button>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto" side="bottom">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>Data Collection</SheetTitle>
          </SheetHeader>
          <StepDataContent fields={fields} meeting={meeting} onSave={onSave} />
        </SheetContent>
      </Sheet>
    </>
  )
}
