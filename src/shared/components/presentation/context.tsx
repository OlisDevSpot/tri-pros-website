'use client'

import type { RefObject } from 'react'
import { createContext, use } from 'react'

export interface PresentationContextValue {
  /** The snapping scroll container. Pass as `root` to every `useInView` inside. */
  scrollerRef: RefObject<HTMLDivElement | null>
  /** Index of the slide crossing the presentation's centre line. See ./DOCS.md#active-slide */
  activeIndex: number
  reportInView: (index: number, inView: boolean) => void
  /** Slides register their element so the scroller can scroll to an index. */
  registerSlide: (index: number, el: HTMLElement | null) => void
}

export const PresentationContext = createContext<PresentationContextValue | null>(null)

export function usePresentation(): PresentationContextValue {
  const ctx = use(PresentationContext)
  if (!ctx) {
    throw new Error('usePresentation must be used inside <Presentation>')
  }
  return ctx
}

/** Whether the enclosing <Slide> is in view. Drives <Reveal> and <SlideImage>. */
export const SlideInViewContext = createContext(false)

export function useSlideInView(): boolean {
  return use(SlideInViewContext)
}
