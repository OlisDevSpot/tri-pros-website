'use client'

import { motion } from 'motion/react'
import { HOUSE_PATHS, R_PATH } from '@/shared/components/splash-screen/splash-paths'

export function SplashAnimation() {
  return (
    <svg
      width="589"
      height="463"
      viewBox="0 0 589 463"
      fill="none"
      className="h-auto w-48 sm:w-56"
    >
      {HOUSE_PATHS.map((d, i) => (
        <motion.path
          key={d.slice(0, 20)}
          d={d}
          fill="white"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.35,
            delay: 0.1 + i * 0.12,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
      <motion.path
        d={R_PATH}
        fill="#03AFED"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: 0.5,
          delay: 0.9,
          type: 'spring',
          bounce: 0.3,
        }}
      />
    </svg>
  )
}
