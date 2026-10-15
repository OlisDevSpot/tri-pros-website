// scrollIntoView, not offsetTop: offsetTop is measured from the nearest positioned ancestor, not the scroll root.
export function scrollToChapter(id: string) {
  const target = document.getElementById(id)
  if (!target) {
    return
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
}
