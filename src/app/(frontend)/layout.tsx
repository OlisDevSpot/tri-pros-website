import type { Metadata, Viewport } from 'next'
import process from 'node:process'
import { Dancing_Script, Nunito, Playfair_Display, Space_Mono, Syne } from 'next/font/google'
import { Providers } from '@/shared/components/providers'
import { PwaSplashScreen } from '@/shared/components/splash-screen/pwa-splash-screen'
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
  metadataBase: new URL('https://triprosremodeling.com'),
  title: {
    default: 'Tri Pros Remodeling',
    template: '%s | Tri Pros Remodeling',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  icons: {
    icon: [
      {
        url: '/company/logo/logo-light.svg',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/company/logo/logo-dark.svg',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: '/pwa/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'TPR',
    statusBarStyle: 'black-translucent',
  },
  description: 'Family-led residential construction company serving Southern California homeowners. Kitchen and bathroom remodels, ADU construction, garage conversions, and home additions across the San Fernando Valley, San Gabriel Valley, and Greater Los Angeles.',
  authors: [{ name: 'Tri Pros Remodeling' }],
  creator: 'Tri Pros Remodeling',
  publisher: 'Tri Pros Remodeling',
  openGraph: {
    title: 'Tri Pros Remodeling | Kitchen, Bath, ADU & Home Remodeling in SoCal',
    description: 'Family-led residential construction company. Kitchen and bathroom remodels, ADU construction, garage conversions, and home additions across the San Fernando Valley, San Gabriel Valley, and Greater Los Angeles.',
    url: 'https://triprosremodeling.com',
    siteName: 'Tri Pros Remodeling',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/company/logo/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Tri Pros Remodeling — Kitchen, Bath, ADU and Home Remodeling in Southern California',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tri Pros Remodeling | Kitchen, Bath, ADU & Home Remodeling in SoCal',
    description: 'Family-led residential construction company. Kitchen and bathroom remodels, ADU construction, garage conversions, and home additions across the San Fernando Valley, San Gabriel Valley, and Greater Los Angeles.',
    images: ['/company/logo/opengraph-image.png'],
  },
  alternates: {
    canonical: 'https://triprosremodeling.com',
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

export const viewport: Viewport = {
  themeColor: '#03AFED',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      data-scroll-behavior="smooth"
      style={{ backgroundColor: '#09090b' }}
    >
      <body
        className={`${syne.variable} ${playfair.variable} ${dancingScript.variable} ${spaceMono.variable} ${nunito.className} antialiased`}
      >
        <Providers>
          <PwaSplashScreen />
          {children}
        </Providers>
      </body>
    </html>
  )
}
