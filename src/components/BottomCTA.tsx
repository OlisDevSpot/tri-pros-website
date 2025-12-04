'use client'

import { motion, useInView } from 'motion/react'
import Link from 'next/link'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'

export default function BottomCTA() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.4 }}
      className="text-center mb-32"
      ref={ref}
    >
      <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
        Join 500+ satisfied homeowners who chose excellence.
        <span className="font-semibold text-muted-foreground">
          {' '}
          Limited project slots available for 2024.
        </span>
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <motion.div
          whileHover={{ scale: 1.025 }}
          whileTap={{ scale: 0.975 }}
        >
          <Button
            asChild
            variant="default"
            className="h-16 text-lg px-8"
          >
            <Link href="/contact">
              <span>Start Your Project</span>
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.span>
            </Link>
          </Button>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.025 }}
          whileTap={{ scale: 0.975 }}
        >
          <Button
            asChild
            variant="outline"
            className="h-16 text-lg px-8"
          >
            <Link href="/testimonials">
              <span>Read More Reviews</span>
            </Link>
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}
