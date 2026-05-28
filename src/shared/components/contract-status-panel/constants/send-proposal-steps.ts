import type { SendProposalStep } from '@/shared/entities/proposals/hooks/use-send-proposal-with-draft'

export interface SendProposalStepDef {
  key: SendProposalStep
  label: string
  activeLabel: string
}

export const SEND_PROPOSAL_STEPS: readonly SendProposalStepDef[] = [
  { key: 'creating-draft', label: 'Prepare signing envelope', activeLabel: 'Preparing signing envelope…' },
  { key: 'sending-email', label: 'Send proposal email', activeLabel: 'Sending proposal email…' },
] as const
