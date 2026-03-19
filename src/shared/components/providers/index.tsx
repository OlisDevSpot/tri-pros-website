'use client'

import { AbilityProvider } from '@/shared/permissions/provider'

import { NuqsProvider } from './nuqs-adapter'
import { ThemeProvider } from './theme-provider'
import { ToasterProvider } from './toaster-provider'
import { TooltipProvider } from './tooltip-provider'
import { TRPCReactProvider } from './trpc-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
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
    </TRPCReactProvider>
  )
}
