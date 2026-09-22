'use client'

import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react'
import type { PresentationHandle } from '@/shared/components/presentation/types'
import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { PresentationContext } from '@/shared/components/presentation/context'
import { slideScrollTop } from '@/shared/components/presentation/slide-scroll-top'
import { cn } from '@/shared/lib/utils'

/** Host markers for the scroller, e.g. `{ 'data-step-root': true }`. `HTMLAttributes` alone rejects a hyphenated key in an object literal. */
type RootAttributes = HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | boolean | undefined>

interface PresentationProps {
  /** Accessible name for the scroll region, e.g. "Who we are presentation". */
  label: string
  /** Attributes the host needs on the scroller, such as the marker its focus management looks for. */
  rootAttributes?: RootAttributes
  /** `aria-keyshortcuts` for the keys the host's key map sends to `ref`. */
  keyShortcuts?: string
  /**
   * A CSS length every engine layer keeps clear at the bottom: the clearance a host
   * publishes under its own floating control. Becomes `--presentation-clear-b` on the scroller.
   */
  clearBottom?: string
  className?: string
  /** Imperative `next` / `prev` for the host's key map. */
  ref?: Ref<PresentationHandle>
  /** The slides: `full` slides and runs (`SlideRun`), in order. */
  children: ReactNode
}

/**
 * Full-height, slide-snapping scroller: the presentation engine's root. Snap is the
 * browser's (CSS scroll-snap); the JS is in-view tracking plus an absolute `scrollTo` for
 * keyboard slide navigation. Rules: see ./DOCS.md#presentation
 * Recipes and citations: docs/plans/2026-09-11-meeting-flow-scroll-snap-research.md,
 * docs/plans/2026-09-13-meeting-flow-keyboard-focus-research.md §4.3.
 *
 * The scroller is the `presentation` size container. Descendants size with `cqw`/`cqh` and
 * switch layout with `@max-[56rem]/presentation:`; the name keeps a query bound to the
 * presentation even when a nearer container sits in between. Scroll padding is 0: each slide
 * carries its own scroll margin (`Slide`). The host reaches in only through named props:
 * `clearBottom` becomes `--presentation-clear-b`, which every engine layer reads as
 * `var(--presentation-clear-b, 0px)`; the engine does not know what the host floats there.
 *
 * The wrapper is a size container of the same box because an element cannot query itself: a
 * property of the scroller written in `cq` units would resolve against the nearest ancestor
 * container, which without the wrapper is the viewport. No property of the scroller uses
 * `cq` units today; the wrapper keeps that safe to add.
 */
export function Presentation({ label, rootAttributes, keyShortcuts, clearBottom, className, ref, children }: PresentationProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const slidesRef = useRef(new Map<number, HTMLElement>())
  const pendingIndexRef = useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const reportInView = useCallback((index: number, inView: boolean) => {
    if (inView) {
      setActiveIndex(index)
    }
  }, [])

  const registerSlide = useCallback((index: number, el: HTMLElement | null) => {
    if (el) {
      slidesRef.current.set(index, el)
    }
    else {
      slidesRef.current.delete(index)
    }
  }, [])

  // The pending target only matters while a smooth scroll is in flight.
  useEffect(() => {
    if (pendingIndexRef.current === activeIndex) {
      pendingIndexRef.current = null
    }
  }, [activeIndex])

  const scrollToIndex = useCallback((index: number) => {
    const scroller = scrollerRef.current
    const section = slidesRef.current.get(index)
    if (!scroller || !section) {
      return
    }
    // An absolute scroll snaps in any direction and is not trapped by `snap-always`. The
    // target is a rect delta, so a positioned wrapper cannot redirect it (review F9).
    pendingIndexRef.current = index
    scroller.scrollTo({ top: slideScrollTop(section, scroller) })
  }, [])

  useImperativeHandle(ref, () => ({
    next: () => {
      const from = pendingIndexRef.current ?? activeIndex
      scrollToIndex(Math.min(slidesRef.current.size - 1, from + 1))
    },
    prev: () => {
      const from = pendingIndexRef.current ?? activeIndex
      scrollToIndex(Math.max(0, from - 1))
    },
  }), [activeIndex, scrollToIndex])

  const value = useMemo(
    () => ({ scrollerRef, activeIndex, reportInView, registerSlide }),
    [activeIndex, reportInView, registerSlide],
  )

  return (
    <MotionConfig reducedMotion="user">
      <PresentationContext value={value}>
        <div className="relative isolate min-h-0 flex-1 [container-type:size]">
          <div
            ref={scrollerRef}
            {...rootAttributes}
            aria-keyshortcuts={keyShortcuts}
            aria-label={label}
            className={cn(
              'absolute inset-0 overflow-y-auto overscroll-contain',
              'snap-y snap-mandatory scroll-pt-0 motion-safe:scroll-smooth [container:presentation/size]',
              'bg-(--presentation-ground) text-white',
              'outline-none',
              className,
            )}
            role="region"
            style={{ '--presentation-clear-b': clearBottom } as CSSProperties}
            tabIndex={0}
          >
            {children}
          </div>
        </div>
      </PresentationContext>
    </MotionConfig>
  )
}
