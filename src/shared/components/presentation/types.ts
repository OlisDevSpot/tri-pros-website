/**
 * The presentation engine's public types. Vocabulary: CONTEXT.md#presentation-terms.
 * Rules: see ./DOCS.md#frames and ./DOCS.md#runs
 */

/** Where a slide's heading sits: in its run's heading column (the default) or centred over the slide. */
export type PresentationFrame = 'column' | 'full'

/** The photo behind a slide. Image only; the trade-matched `portfolio` kind arrives with spec D. */
export interface PresentationBackground {
  kind: 'image'
  src: string
  alt: string
}

/** A slide's heading: shown in its run's column (`column`) or centred on the slide (`full`). */
export interface PresentationHeading {
  title: string
  /** The second line under the title; `accent` is its accent-coloured tail, e.g. 'due diligence.' */
  subheading?: {
    text: string
    accent?: string
  }
  /** Position in the numbered sequence; absent on unnumbered slides. */
  number?: number
}

/** One screen of a presentation. Generic over its content, so each feature authors its own slides (L9). */
export interface PresentationSlide<TContent> {
  id: string
  /** Defaults to `'column'`, resolved once by `groupSlides`. */
  frame?: PresentationFrame
  heading: PresentationHeading
  background?: PresentationBackground
  content: TContent
}

/** A slide with its position in the presentation and its resolved frame. */
export interface IndexedSlide<TContent> {
  slide: PresentationSlide<TContent>
  index: number
  frame: PresentationFrame
}

/** The presentation grouped for layout: a `full` slide alone, or a run of consecutive `column` slides sharing one heading column. */
export type PresentationGroup<TContent>
  = | { kind: 'full', item: IndexedSlide<TContent> }
    | { kind: 'run', items: IndexedSlide<TContent>[] }

/** What a slide component receives: the slide's fields with its resolved frame and its index, derived, never restated. */
export type SlideProps<TContent> = Omit<PresentationSlide<TContent>, 'frame'> & { index: number, frame: PresentationFrame }

/** Imperative surface a presentation exposes to its host's key map. */
export interface PresentationHandle {
  next: () => void
  prev: () => void
}
