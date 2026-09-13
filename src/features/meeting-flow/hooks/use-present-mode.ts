'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSidebar } from '@/shared/components/ui/sidebar'

/**
 * Present mode: collapse the app sidebar to icons (the view hides its own top
 * bar), then put the sidebar back the way the agent had it.
 *
 * Uses the shadcn provider's own `setOpen`, which also writes the
 * `sidebar_state` cookie; a reload while presenting therefore boots with the
 * sidebar collapsed (accepted, spec §2). Below `md` the sidebar is a sheet, so
 * only the top bar changes there.
 */
export function usePresentMode() {
  const { open, setOpen, isMobile } = useSidebar()
  const [presenting, setPresenting] = useState(false)
  const rememberedOpenRef = useRef(open)
  const latestRef = useRef({ presenting, isMobile, setOpen })

  useEffect(() => {
    latestRef.current = { presenting, isMobile, setOpen }
  }, [presenting, isMobile, setOpen])

  const enter = useCallback(() => {
    rememberedOpenRef.current = open
    if (!isMobile) {
      setOpen(false)
    }
    setPresenting(true)
  }, [open, isMobile, setOpen])

  const exit = useCallback(() => {
    if (!isMobile) {
      setOpen(rememberedOpenRef.current)
    }
    setPresenting(false)
  }, [isMobile, setOpen])

  const toggle = useCallback(() => {
    if (presenting) {
      exit()
    }
    else {
      enter()
    }
  }, [presenting, enter, exit])

  // ⌘/Ctrl+B or the sidebar's own rail re-opened the sidebar: chrome returns as one unit.
  useEffect(() => {
    if (presenting && open && !isMobile) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- the sidebar changed outside this hook; mirrors use-mobile.ts
      setPresenting(false)
    }
  }, [presenting, open, isMobile])

  // Leaving the route while presenting must not leave the sidebar collapsed.
  useEffect(() => {
    return () => {
      const latest = latestRef.current
      if (latest.presenting && !latest.isMobile) {
        latest.setOpen(rememberedOpenRef.current)
      }
    }
  }, [])

  return { presenting, toggle, exit }
}
