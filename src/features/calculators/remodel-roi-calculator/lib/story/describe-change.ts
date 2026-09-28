export function changeVerb(percent: number): 'rise' | 'fall' {
  return percent < 0 ? 'fall' : 'rise'
}
