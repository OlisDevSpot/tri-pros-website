import type { HTMLMotionProps, Variants } from 'motion/react'
import { motion } from 'motion/react'
import Image from 'next/image'
import React, { createContext } from 'react'
import { cn } from '@/lib/utils'

interface Blogpost {
  image: string
  title: string
  snippet: string
}

interface BlogpostCardContextProps {
  blogpost: Blogpost
}

const BlogpostCardContext = createContext<BlogpostCardContextProps | null>(null)

export function useBlogpostCardContext() {
  const context = React.use(BlogpostCardContext)
  if (!context) {
    throw new Error('useBlogpostContext must be used within a BlogpostProvider')
  }
  return context
}

interface BlogpostCardProviderProps {
  children: React.ReactNode
  blogpost: Blogpost
}

export function BlogpostCardProvider({ children, blogpost }: BlogpostCardProviderProps) {
  return (
    // eslint-disable-next-line react/no-unstable-context-value
    <BlogpostCardContext value={{ blogpost }}>
      {children}
    </BlogpostCardContext>
  )
}

interface BlogpostCardProps {
  blogpost: Blogpost
  children: React.ReactNode
}

export function BlogpostCard({
  blogpost,
  children,
}: BlogpostCardProps) {
  return (
    <BlogpostCardProvider blogpost={blogpost}>
      {children}
    </BlogpostCardProvider>
  )
}

interface BlogpostCardFrameProps extends HTMLMotionProps<'div'> {
  variants: Variants
  children?: React.ReactNode
  className?: string
  showHeader?: boolean
}

export function BlogpostCardFrame({ variants, children, className, showHeader = false, ...props }: BlogpostCardFrameProps) {
  return (
    <motion.div
      className={cn(
        'relative flex flex-col min-h-[300px] rounded-lg overflow-hidden cursor-pointer',
        className,
      )}
      variants={variants}
      initial="hidden"
      animate="visible"
      {...props}
    >
      {showHeader && (
        <>
          <BlogpostCard.Header className="absolute z-10 pointer-events-none peer">
            <BlogpostCard.Title />
            <BlogpostCard.Snippet />
          </BlogpostCard.Header>
          <BlogpostCard.Image />

          {/* Overlay */}
          <div className="absolute inset-0 bg-background/50 pointer-events-none z-5" />
        </>
      )}

      {children}
    </motion.div>
  )
}

interface BlogpostCardHeaderProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode
}

export function BlogpostCardHeader({ children, className, ...props }: BlogpostCardHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut', delay: 0.3 }}
      className={cn('relative flex flex-col p-4 peer', className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function BlogpostCardTitle() {
  const { blogpost } = useBlogpostCardContext()
  return (
    <motion.h3 className="text-foreground text-2xl font-bold">
      {blogpost.title}
    </motion.h3>
  )
}

export function BlogpostCardSnippet() {
  const { blogpost } = useBlogpostCardContext()
  return (
    <motion.p className="text-foreground text-base">{blogpost.snippet}</motion.p>
  )
}

interface BlogpostCardImageProps {
  className?: string
}

export function BlogpostCardImage({ className }: BlogpostCardImageProps) {
  const { blogpost } = useBlogpostCardContext()

  return (
    <motion.div className={cn('absolute insert-0 h-full w-full transition-all duration-300 hover:scale-105', className)}>
      <Image
        src={blogpost.image}
        alt={blogpost.title}
        fill
        className="object-cover"
      />
    </motion.div>
  )
}

BlogpostCard.displayName = 'BlogpostCard'
BlogpostCard.Frame = BlogpostCardFrame
BlogpostCard.Header = BlogpostCardHeader
BlogpostCard.Title = BlogpostCardTitle
BlogpostCard.Snippet = BlogpostCardSnippet
BlogpostCard.Image = BlogpostCardImage
