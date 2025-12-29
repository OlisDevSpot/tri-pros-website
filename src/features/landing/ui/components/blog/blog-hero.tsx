'use client'

import type { Variants } from 'motion/react'
import { motion } from 'motion/react'

import { TopSpacer } from '@/shared/components/top-spacer'
import { ViewportHero } from '@/shared/components/viewport-hero'
import { blogPostTitles } from '@/features/landing/data/blog'
import { BlogpostCard } from './blogpost-card'

const parentVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeInOut',
      staggerChildren: 0.2,
    },
  },
}

const childVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

export default function BlogHero() {
  return (
    <ViewportHero>
      <TopSpacer>
        <motion.div
          className="container flex flex-col lg:flex-row gap-4 h-full w-full"
          variants={parentVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="flex-2 h-[600px] lg:h-auto"
            variants={childVariants}
          >
            <BlogpostCard
              blogpost={{
                image: '/hero-photos/modern-house-1.png',
                title: blogPostTitles[0],
                snippet: 'This is a modern house',
              }}
            >
              <BlogpostCard.Frame
                className="h-full"
                variants={childVariants}
              >
                <motion.div className="grow overflow-hidden rounded-lg">
                  <BlogpostCard.Image className="relative" overlayClassName="bg-transparent group-hover:bg-background/30" />
                </motion.div>
                <BlogpostCard.Header className="px-0">
                  <BlogpostCard.Title />
                  <BlogpostCard.Snippet />
                </BlogpostCard.Header>

              </BlogpostCard.Frame>
            </BlogpostCard>
          </motion.div>
          <motion.div className="flex-1 flex flex-col gap-4 h-full">
            <BlogpostCard
              blogpost={{
                image: '/hero-photos/modern-house-2.png',
                title: blogPostTitles[1],
                snippet: 'This is a modern house',
              }}
            >
              <BlogpostCard.Frame
                variants={childVariants}
                showHeader
                containerSize="sm"
              />
            </BlogpostCard>
            <BlogpostCard
              blogpost={{
                image: '/hero-photos/modern-house-4.webp',
                title: blogPostTitles[2],
                snippet: 'This is a modern house',
              }}
            >
              <BlogpostCard.Frame
                variants={childVariants}
                showHeader
              />
            </BlogpostCard>
            <BlogpostCard
              blogpost={{
                image: '/hero-photos/modern-house-5.jpg',
                title: blogPostTitles[2],
                snippet: 'This is a modern house',
              }}
            >
              <BlogpostCard.Frame
                variants={childVariants}
                showHeader
              />
            </BlogpostCard>
          </motion.div>
        </motion.div>
      </TopSpacer>
    </ViewportHero>
  )
}
