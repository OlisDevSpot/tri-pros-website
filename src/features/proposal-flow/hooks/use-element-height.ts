import { useCallback, useEffect, useRef, useState } from 'react'

export function useElementHeight<T extends HTMLElement>() {
  const observerRef = useRef<ResizeObserver | null>(null)
  const [height, setHeight] = useState(0)

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) {
      return
    }
    setHeight(node.getBoundingClientRect().height)
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.borderBoxSize[0].blockSize)
    })
    observer.observe(node, { box: 'border-box' })
    observerRef.current = observer
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return [ref, height] as const
}
