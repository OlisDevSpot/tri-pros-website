'use client'
import { useTheme } from 'next-themes'
import { Toaster } from 'sonner'

export function ToasterProvider() {
  const { theme } = useTheme()

  return (
    <Toaster
      position="top-center"
      theme={theme as 'light' | 'dark'}
    />
  )
}
