import Footer from '@/components/Footer'
import Navigation from '@/components/navigation/Navigation'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        '--header-height': '80px',
      } as React.CSSProperties}
    >
      <Navigation />
      <main className="">
        {children}
      </main>
      <Footer />
    </div>
  )
}
