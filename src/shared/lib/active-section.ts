export interface SectionTop {
  id: string
  /** Null when the section is not rendered. */
  top: number | null
}

interface LineInput {
  rootTop: number
  clientHeight: number
  /** Pixels at the root's top that sticky chrome covers. */
  offset: number
  /** Where the line sits in the visible rest of the root, 0 at its top. */
  ratio: number
}

export function trackingLine({ rootTop, clientHeight, offset, ratio }: LineInput): number {
  return rootTop + offset + (clientHeight - offset) * ratio
}

// The section whose top has crossed the line wins; the last wins at the bottom. A highest-ratio rule let a tall
// section keep winning while a short one passed under the line, which made the tabs backtrack.
export function activeSectionAt(sections: readonly SectionTop[], line: number, atBottom: boolean): string {
  if (atBottom) {
    return sections.at(-1)?.id ?? ''
  }
  let active = sections[0]?.id ?? ''
  for (const { id, top } of sections) {
    if (top !== null && top <= line) {
      active = id
    }
  }
  return active
}

// Two pixels of slack: fractional scroll offsets never quite reach scrollHeight.
export function isScrolledToBottom({ scrollTop, clientHeight, scrollHeight }: { scrollTop: number, clientHeight: number, scrollHeight: number }): boolean {
  return scrollTop + clientHeight >= scrollHeight - 2
}
