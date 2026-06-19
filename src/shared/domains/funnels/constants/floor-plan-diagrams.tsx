import type { ReactNode } from 'react'

interface DiagramProps { className?: string }

/** Top-down kitchen floor-plan glyphs. Room outline + counter runs (filled). */
function Frame({ className, children }: DiagramProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="2" className="opacity-30" />
      {children}
    </svg>
  )
}

export function LShapeDiagram(props: DiagramProps) {
  return (
    <Frame {...props}>
      <rect x="8" y="8" width="8" height="28" fill="currentColor" stroke="none" />
      <rect x="8" y="28" width="28" height="8" fill="currentColor" stroke="none" />
    </Frame>
  )
}

export function UShapeDiagram(props: DiagramProps) {
  return (
    <Frame {...props}>
      <rect x="8" y="8" width="8" height="32" fill="currentColor" stroke="none" />
      <rect x="32" y="8" width="8" height="32" fill="currentColor" stroke="none" />
      <rect x="8" y="32" width="32" height="8" fill="currentColor" stroke="none" />
    </Frame>
  )
}

export function GalleyDiagram(props: DiagramProps) {
  return (
    <Frame {...props}>
      <rect x="8" y="8" width="8" height="32" fill="currentColor" stroke="none" />
      <rect x="32" y="8" width="8" height="32" fill="currentColor" stroke="none" />
    </Frame>
  )
}

export function IslandDiagram(props: DiagramProps) {
  return (
    <Frame {...props}>
      <rect x="8" y="8" width="32" height="7" fill="currentColor" stroke="none" />
      <rect x="18" y="26" width="12" height="12" fill="currentColor" stroke="none" />
    </Frame>
  )
}

export function OpenDiagram(props: DiagramProps) {
  return (
    <Frame {...props}>
      <rect x="8" y="8" width="22" height="8" fill="currentColor" stroke="none" />
    </Frame>
  )
}

export function NotSureDiagram(props: DiagramProps) {
  return (
    <Frame {...props}>
      <text x="24" y="32" textAnchor="middle" fontSize="22" fill="currentColor" stroke="none">?</text>
    </Frame>
  )
}
