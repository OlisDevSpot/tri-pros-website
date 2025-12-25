import Footer from '@/components/footer'
import { SiteNavbar } from '@/components/navigation/site-navbar'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
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
  )
}
