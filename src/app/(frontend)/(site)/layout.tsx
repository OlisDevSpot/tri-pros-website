import { Suspense } from 'react'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import Footer from '@/shared/components/footer'
import { SiteNavbar } from '@/shared/components/navigation/site-navbar'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalDialogs />
      {/*
        --navbar-height = visible content-row height of the navbar.
        --navbar-bottom = y-coordinate where the navbar ends. In a PWA, the
        navbar's outer wrapper pads `env(safe-area-inset-top)` above its
        content row, so consumers that want to clear the navbar (TopSpacer,
        hero offsets, etc.) must use --navbar-bottom — not --navbar-height —
        or content slides under the status bar on iPhones.
      */}
      <div
        style={{
          '--navbar-height': '80px',
          '--navbar-bottom': 'calc(var(--navbar-height) + env(safe-area-inset-top))',
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
