import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AppProviders } from '@/components/providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const jbMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jbmono', display: 'swap' })

export const metadata: Metadata = {
  title: 'Veltrix — Market Analytics Terminal',
  description:
    'A market analytics terminal where every number traces back to the data behind it: live crypto and equity pricing, an auditable technical signal engine, walk-forward validated forecasts, and RLS-secured paper portfolios.',
  openGraph: {
    title: 'Veltrix — Market Analytics Terminal',
    description:
      'Auditable signals, walk-forward validated forecasts, and paper trading against live prices.',
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0b0d10',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // The clip must be on <html>, not only <body>. The viewport takes its
  // overflow from the root element, so a clip applied solely to body left the
  // landing page's marquee genuinely horizontally scrollable — scrollTo(500, y)
  // moved it. Kept as `clip` rather than `hidden` because `hidden` would make
  // this a scroll container and silently break `position: sticky`.
  return (
    <html
      lang="en"
      className={`bg-background [overflow-x:clip] ${inter.variable} ${jbMono.variable}`}
    >
      <body className="font-sans antialiased [overflow-x:clip]">
        <AppProviders>{children}</AppProviders>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
