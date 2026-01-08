import { Suspense } from 'react'
import { ProposalPageNavbar } from '@/features/proposal-flow/ui/components/navbar/navbar'
import { ProposalFlowLoadingState } from '@/features/proposal-flow/ui/components/states/loading'

export default async function ProposalFlowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        '--sidebar-width': '76px',
        'background': `radial-gradient(150% 150% at 50% 0%, var(--background), var(--background), color-mix(in oklab, var(--primary) 60%, transparent))`,
      } as React.CSSProperties}
      className="h-dvh flex flex-col"
      // REMOVE GUTTER STABLE FROM <html>
      data-no-gutter-stable
    >
      <ProposalPageNavbar />
      <div className="container grow min-h-0 py-4 lg:py-8">
        <div className="h-full">
          <Suspense fallback={<ProposalFlowLoadingState />}>
            {children}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
