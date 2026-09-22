/**
 * The scrollTop that rests `section` at its snap position: its top relative to the scroller,
 * minus its scroll margin. Measured from rects, so it does not depend on which ancestor is
 * positioned, unlike `offsetTop` (spec C §4.1, review F9). See ./DOCS.md#keyboard-jumps
 */
export function slideScrollTop(section: HTMLElement, scroller: HTMLElement): number {
  const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0
  return section.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - margin
}
