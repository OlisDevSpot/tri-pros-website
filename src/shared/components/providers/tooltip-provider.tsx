import { TooltipProvider as ShadcnTooltipProvider } from '@/shared/components/ui/tooltip'

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <ShadcnTooltipProvider>{children}</ShadcnTooltipProvider>
}
