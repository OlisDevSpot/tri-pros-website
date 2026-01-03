// import { headers as getHeaders } from 'next/headers'
// import { auth } from '@/features/auth/server'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import Footer from '@/shared/components/footer'
import { SiteNavbar } from '@/shared/components/navigation/site-navbar'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // const session = await auth.api.getSession({
  //   headers: await getHeaders(),
  // })

  return (
    <>
      <GlobalDialogs />
      {/* <AppSidebar
        sidebarItemsGroups={generateNavItemsGroups({ navType: !session ? 'public' : 'user' })}
      /> */}
      <div
        style={{
          '--navbar-height': '80px',
        } as React.CSSProperties}
      >
        <SiteNavbar />
        <main className="relative z-10 bg-background">
          {children}
        </main>
        <Footer />
      </div>
    </>
  )
}
