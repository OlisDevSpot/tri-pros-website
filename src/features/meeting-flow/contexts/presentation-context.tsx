'use client'

import type { RefObject } from 'react'
import { createContext, use } from 'react'

export interface PresentationContextValue {
  /** The snapping scroll container. Pass as `root` to every `useInView` inside. */
  scrollerRef: RefObject<HTMLDivElement | null>
  /** Index of the section currently past the in-view threshold. */
  activeIndex: number
  reportInView: (index: number, inView: boolean) => void
  /** Sections register their element so the scroller can scroll to an index. */
  registerSection: (index: number, el: HTMLElement | null) => void
}

export const PresentationContext = createContext<PresentationContextValue | null>(null)

export function usePresentation(): PresentationContextValue {
  const ctx = use(PresentationContext)
  if (!ctx) {
    throw new Error('usePresentation must be used inside <SnapPresentation>')
  }
  return ctx
}

/** Whether the enclosing <SnapSection> is in view. Drives <Reveal> and <SectionImage>. */
export const SectionInViewContext = createContext(false)

export function useSectionInView(): boolean {
  return use(SectionInViewContext)
}
