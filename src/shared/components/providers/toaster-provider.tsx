'use client'
import { useTheme } from 'next-themes'
import { Toaster } from 'sonner'

export function ToasterProvider() {
  const { theme } = useTheme()

  return (
    <Toaster
      position="top-center"
      theme={theme as 'light' | 'dark'}
      className="[&_[data-sonner-toast][data-visible=true]]:pointer-events-auto"
    />
  )
}
