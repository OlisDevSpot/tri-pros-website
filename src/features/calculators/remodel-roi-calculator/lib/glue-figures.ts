// On narrow canvases a long emphasis may wrap, but a figure never parts from the word beside it ("year 3", "$4,400 more").
export function glueFigures(text: string): string {
  // Two passes instead of one lookbehind: Safari before 16.4 can't parse lookbehind and would drop the whole chunk.
  return text.replace(/(\d) /g, '$1 ').replace(/ (?=[−+-]?\$?\d)/g, ' ')
}
