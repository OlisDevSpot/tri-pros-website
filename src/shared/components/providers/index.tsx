'use client'

import { AbilityProvider } from './casl-provider'
import { NuqsProvider } from './nuqs-adapter'
import { RealtimeProvider } from './realtime-provider'
import { ThemeProvider } from './theme-provider'
import { ToasterProvider } from './toaster-provider'
import { TooltipProvider } from './tooltip-provider'
import { TRPCReactProvider } from './trpc-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <RealtimeProvider>
        <AbilityProvider>
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
        </AbilityProvider>
      </RealtimeProvider>
    </TRPCReactProvider>
  )
}
