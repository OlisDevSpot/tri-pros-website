import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { ProposalPageNavbar } from '@/features/proposals/ui/components/proposal/proposal-navbar'
import { ProposalSidebar } from '@/features/proposals/ui/components/sidebar'
import { requireAuth } from '@/shared/auth/lib/utils'
import { ROOTS } from '@/shared/config/roots'

export default async function ProposalFlowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth(await getHeaders(), () => {
    redirect(`${ROOTS.generateUrl('/', { absolute: true })}`)
  })

  return (
    <div
      style={{
        background: `radial-gradient(150% 150% at 50% 0%, var(--background), var(--background), color-mix(in oklab, var(--primary) 60%, transparent))`,
      }}
      className="h-dvh flex flex-col"
    >
      <ProposalPageNavbar />
      <div className="container grow min-h-0 py-4 lg:py-8">
        <div className="h-full flex gap-4 justify-between">
          <nav className="h-fit border border-primary/20 p-4 rounded-xl">
            <ProposalSidebar />
          </nav>
          {children}
        </div>
      </div>
    </div>
  )
}
