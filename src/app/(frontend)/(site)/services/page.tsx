import type { Metadata } from 'next'
import { ServicesView } from '@/features/landing/ui/views/services-view'

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Comprehensive construction services including custom homes, luxury renovations, commercial projects, and design-build services. View our complete service portfolio and pricing.',
}

export default function ServicesPage() {
  return (
    <main className="h-full">
      <ServicesView />
    </main>
  )
}
