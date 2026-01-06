import { Suspense } from 'react'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import Footer from '@/shared/components/footer'
import { SiteNavbar } from '@/shared/components/navigation/site-navbar'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalDialogs />
      <div
        style={{
          '--navbar-height': '80px',
        } as React.CSSProperties}
      >
        <Suspense fallback={<div></div>}>
          <SiteNavbar />
        </Suspense>
        <main className="relative z-10 bg-background">
          {children}
        </main>
        <Footer />
      </div>
    </>
  )
}
