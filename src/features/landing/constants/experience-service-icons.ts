import type { LucideIcon } from 'lucide-react'
import type { ServiceSlugs } from '@/shared/constants/nav-items/marketing'
import { Building2, Hammer, Home, PenTool } from 'lucide-react'

export const experienceServiceIcons: Record<ServiceSlugs, LucideIcon> = {
  'energy-efficient-construction': Home,
  'luxury-renovations': Hammer,
  'commercial': Building2,
  'design-build': PenTool,
}
