import { ProposalPageNavbar } from '@/features/proposals/ui/components/proposal/proposal-navbar'

export default function ProposalFlowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: `radial-gradient(150% 150% at 50% 0%, var(--background), var(--background), color-mix(in oklab, var(--primary) 60%, transparent))`,
      }}
      className="h-dvh flex flex-col"
    >
      <ProposalPageNavbar />
      <div className="grow min-h-0 py-4 lg:py-8">
        {children}
      </div>
    </div>
  )
}
