import { useEffect, useRef, useState } from 'react'

export function useIsScrolled(threshold: number = 0): boolean {
  const [isScrolled, setIsScrolled] = useState(false)
  const isScrolledRef = useRef(isScrolled)
  const ticking = useRef(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrolled = scrollTop > threshold

      if (isScrolledRef.current !== scrolled) {
        isScrolledRef.current = scrolled
        setIsScrolled(scrolled)
      }
      ticking.current = false
    }

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true
        requestAnimationFrame(handleScroll)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })

    // Initial check in case user is already scrolled
    handleScroll()

    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [threshold])

  return isScrolled
}
