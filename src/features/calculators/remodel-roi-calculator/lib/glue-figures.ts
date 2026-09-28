// On narrow canvases a long emphasis may wrap, but a figure never parts from the word beside it ("year 3", "$4,400 more").
export function glueFigures(text: string): string {
  return text.replace(/(?<=\d) | (?=[−+-]?\$?\d)/g, ' ')
}
