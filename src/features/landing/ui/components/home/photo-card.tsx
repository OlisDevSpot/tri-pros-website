import { ArrowRightCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function PhotoCard({ photo }: { photo: string }) {
  const [hovered, setHovered] = useState(false)
  const router = useRouter()

  return (
    <motion.div
      className="relative h-full min-w-[500px] rounded-md overflow-hidden"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => router.push('/portfolio')}
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute flex items-center justify-center h-full w-full cursor-pointer"
          >
            <div className="absolute inset-0 bg-black/30 z-10" />
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              exit={{ y: -20 }}
              className="bg-foreground rounded-full px-4 py-2 z-10 flex items-center justify-center gap-1"
            >
              <p className="text-sm text-background">View Project</p>
              <ArrowRightCircle
                size={20}
                className="text-background"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <img
        src={photo}
        alt="project 1"
        className="object-cover h-full w-full"
      />
    </motion.div>
  )
}
