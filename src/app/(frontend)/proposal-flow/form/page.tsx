import { ProposalForm } from '@/features/proposals/ui/components/form'

export default function ProposalFormPage() {
  return (
    <div
      style={{
        background: `radial-gradient(150% 150% at 50% 0%, var(--background), var(--background), color-mix(in oklab, var(--primary) 60%, transparent))`,
      }}
      className="grow min-h-0 h-auto p-8 overflow-auto"
    >
      <ProposalForm />
    </div>
  )
}
