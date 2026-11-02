'use client'

import type { BufferGeometry } from 'three'

import { useEffect, useMemo } from 'react'

// Geometry handed to a mesh through `args` is not disposed by R3F, so the owner disposes it or the iPad leaks GPU memory.
export function useOwnedGeometry<T extends BufferGeometry>(create: () => T, deps: readonly unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(create, deps)
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}
