'use client'

import { ActionCenterView } from '@/features/agent-dashboard/ui/views/action-center-view'
import { BaseSheet } from '@/shared/components/dialogs/sheets/base-sheet'

interface ActionCenterSheetProps {
  isOpen: boolean
  onClose: () => void
}

export function ActionCenterSheet({ isOpen, onClose }: ActionCenterSheetProps) {
  return (
    <BaseSheet isOpen={isOpen} close={onClose} title="Action Center">
      <ActionCenterView />
    </BaseSheet>
  )
}
