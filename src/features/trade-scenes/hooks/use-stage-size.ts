'use client'

import type { RefObject } from 'react'

import { useLayoutEffect, useState } from 'react'

interface StageSize {
  width: number
  height: number
  // In the viewport: the dashboard sidebar's slide narrows the stage from the left and leaves this edge where it is.
  right: number
}

// Read once before the first paint, then on every resize, so nothing placed by the stage's shape draws a frame at 0×0.
export function useStageSize(ref: RefObject<HTMLElement | null>): StageSize {
  const [size, setSize] = useState<StageSize>({ width: 0, height: 0, right: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) {
      return
    }
    const read = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      const { right } = element.getBoundingClientRect()
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- the size exists only once laid out, and must land before paint
      setSize(current => current.width === width && current.height === height && current.right === right ? current : { width, height, right })
    }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}
