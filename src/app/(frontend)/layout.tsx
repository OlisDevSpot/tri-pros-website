import type { Metadata } from 'next'
import { Dancing_Script, Nunito, Playfair_Display, Space_Mono, Syne } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const playfair = Playfair_Display({
  variable: '--font-serif',
  subsets: ['latin'],
  display: 'swap',
})

const syne = Syne({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

const dancingScript = Dancing_Script({
  variable: '--font-script',
  subsets: ['latin'],
  display: 'swap',
})

const spaceMono = Space_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
})

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Tri Pros Remodeling',
    template: '%s | Tri Pros Remodeling',
  },
  icons: [
    {
      url: '/company/logo/logo-light.svg',
      media: '(prefers-color-scheme: light)',
    },
    {
      url: '/company/logo/logo-dark.svg',
      media: '(prefers-color-scheme: dark)',
    },
  ],
  description: 'Premium construction services for discerning homeowners and businesses who demand excellence. 25+ years experience building architectural masterpieces that stand the test of time.',
  keywords: 'luxury construction, custom homes, premium renovations, commercial construction, elite builders',
  authors: [{ name: 'Tri Pros Remodeling' }],
  creator: 'Tri Pros Remodeling',
  openGraph: {
    title: 'Tri Pros Remodeling | Crafting Architectural Masterpieces',
    description: 'Premium construction services for discerning homeowners and businesses who demand excellence.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tri Pros Remodeling | Luxury Custom Homes',
    description:
      'Premium construction services for discerning homeowners and businesses who demand excellence.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      'index': true,
      'follow': true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className="dark"
      suppressHydrationWarning
    >
      <body
        className={`${syne.variable} ${playfair.variable} ${dancingScript.variable} ${spaceMono.variable} ${nunito.className} antialiased`}
      >
        <Providers>
          {children}
        </Providers>

      </body>
    </html>
  )
}
