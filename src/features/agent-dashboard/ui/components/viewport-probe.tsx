'use client'

import { useEffect, useRef, useState } from 'react'

// Temporary instrument for the iPad PWA rail height bug: the readings only exist on the device,
// and the installed app has no address bar, so they render on the dashboard itself. Remove once read.
const PROBES = [
  ['100svh', { top: 0, height: '100svh' }],
  ['100dvh', { top: 0, height: '100dvh' }],
  ['100lvh', { top: 0, height: '100lvh' }],
  ['100vh', { top: 0, height: '100vh' }],
  ['100%', { top: 0, height: '100%' }],
  ['top0+bottom0', { top: 0, bottom: 0 }],
] as const

type Reading = Record<string, string | number>

function read(probes: Record<string, HTMLDivElement | null>, inset: HTMLDivElement | null): Reading {
  const r: Reading = {}
  for (const [name] of PROBES) {
    const el = probes[name]
    if (el) {
      r[name] = Math.round(el.getBoundingClientRect().height)
    }
  }
  if (inset) {
    const cs = getComputedStyle(inset)
    r['inset top/bottom'] = `${cs.paddingTop} / ${cs.paddingBottom}`
  }
  r['screen.height'] = screen.height
  r.innerHeight = innerHeight
  r['visualViewport h/top'] = `${Math.round(visualViewport?.height ?? -1)} / ${Math.round(visualViewport?.offsetTop ?? -1)}`
  r['html clientHeight'] = document.documentElement.clientHeight
  r['html rect h'] = Math.round(document.documentElement.getBoundingClientRect().height)
  r['body rect h'] = Math.round(document.body.getBoundingClientRect().height)
  const rail = document.querySelector('[data-slot=sidebar-container]')?.getBoundingClientRect()
  r['rail top/h/bottom'] = rail ? `${Math.round(rail.top)} / ${Math.round(rail.height)} / ${Math.round(rail.bottom)}` : 'none'
  r.standalone = String(matchMedia('(display-mode: standalone)').matches)
  r.referrer = document.referrer ? new URL(document.referrer).host : '(none)'
  return r
}

export function ViewportProbe() {
  const probes = useRef<Record<string, HTMLDivElement | null>>({})
  const inset = useRef<HTMLDivElement | null>(null)
  const [atLoad, setAtLoad] = useState<Reading | null>(null)
  const [now, setNow] = useState<Reading | null>(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setAtLoad(read(probes.current, inset.current))
    const tick = () => setNow(read(probes.current, inset.current))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      {PROBES.map(([name, style]) => (
        <div
          key={name}
          ref={(el) => {
            probes.current[name] = el
          }}
          aria-hidden
          style={{ position: 'fixed', left: 0, width: 1, visibility: 'hidden', pointerEvents: 'none', ...style }}
        />
      ))}
      <div
        ref={inset}
        aria-hidden
        style={{ position: 'fixed', visibility: 'hidden', pointerEvents: 'none', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      />
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-100 max-w-[22rem] rounded-lg bg-black/85 p-2 text-left font-mono text-xs leading-tight text-white shadow-lg"
      >
        {open && atLoad && now
          ? (
              <table>
                <thead>
                  <tr>
                    <th className="pr-3 text-left">viewport probe</th>
                    <th className="pr-3 text-left">at load</th>
                    <th className="text-left">now</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(now).map(k => (
                    <tr key={k}>
                      <td className="pr-3 opacity-70">{k}</td>
                      <td className="pr-3">{atLoad[k]}</td>
                      <td>{now[k]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          : 'probe'}
      </button>
    </>
  )
}
