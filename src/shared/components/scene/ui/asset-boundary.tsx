'use client'

import type { ReactNode } from 'react'

import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

interface AssetBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

// A missing model resolves to null and draws its own stand-in; this boundary is the last resort for anything that still throws
// (a decoder bug, a bad palette), and it also draws the stand-in while a slow model loads.
export function AssetBoundary({ fallback, children }: AssetBoundaryProps) {
  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  )
}
