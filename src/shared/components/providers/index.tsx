'use client'

import { NuqsProvider } from './nuqs-adapter'
import { ThemeProvider } from './theme-provider'
import { ToasterProvider } from './toaster-provider'
import { TooltipProvider } from './tooltip-provider'
import { TRPCReactProvider } from './trpc-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <NuqsProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <ToasterProvider />
        </ThemeProvider>
      </NuqsProvider>
    </TRPCReactProvider>
  )
}
