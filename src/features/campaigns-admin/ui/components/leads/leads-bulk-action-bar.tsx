'use client'

import { AnimatePresence, motion } from 'motion/react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { BulkEnrollPopover } from '@/features/campaigns-admin/ui/components/leads/bulk-enroll-popover'
import { Button } from '@/shared/components/ui/button'
import { useConfirm } from '@/shared/hooks/use-confirm'

interface LeadsBulkActionBarProps {
  onClear: () => void
  selectedIds: string[]
}

export function LeadsBulkActionBar({ onClear, selectedIds }: LeadsBulkActionBarProps) {
  const { disqualifyBulk, markDnc, removeBulk } = useCampaignMutations()
  const [ConfirmDialog, confirm] = useConfirm({
    message: 'This affects every selected lead and stops/curates their CloudTalk calls.',
    title: 'Apply to selected leads?',
  })

  const count = selectedIds.length
  const settle = () => onClear()

  return (
    <>
      <ConfirmDialog />
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-0 bottom-4 z-20 mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-lg"
            exit={{ opacity: 0, y: 16 }}
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
          >
            <span className="text-sm font-medium tabular-nums">
              {count}
              {' '}
              selected
            </span>
            <span className="mx-1 h-4 w-px bg-border" />
            <BulkEnrollPopover
              selectedIds={selectedIds}
              onDone={onClear}
            />
            <Button
              onClick={() => {
                removeBulk.mutate({ customerIds: selectedIds }, { onSuccess: settle })
              }}
              size="sm"
              variant="outline"
            >
              Remove
            </Button>
            <span className="mx-1 h-4 w-px bg-border" />
            <Button
              className="text-amber-700 dark:text-amber-400"
              onClick={async () => {
                if (await confirm()) {
                  disqualifyBulk.mutate({ customerIds: selectedIds }, { onSuccess: settle })
                }
              }}
              size="sm"
              variant="ghost"
            >
              Disqualify
            </Button>
            <Button
              className="text-red-600"
              onClick={async () => {
                if (await confirm()) {
                  markDnc.mutate({ customerIds: selectedIds }, { onSuccess: settle })
                }
              }}
              size="sm"
              variant="ghost"
            >
              Mark DNC
            </Button>
            <span className="mx-1 h-4 w-px bg-border" />
            <Button onClick={onClear} size="sm" variant="ghost">
              Clear
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
