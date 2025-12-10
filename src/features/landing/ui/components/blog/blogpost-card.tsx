import type { HTMLMotionProps, Variants } from 'motion/react'
import { motion } from 'motion/react'
import Image from 'next/image'
import React, { createContext } from 'react'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface Blogpost {
  image: string
  title: string
  snippet: string
  date: Date
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
  blogpost: Omit<Blogpost, 'date'> & { date?: Date }
}

export function BlogpostCardProvider({ children, blogpost }: BlogpostCardProviderProps) {
  return (
    // eslint-disable-next-line react/no-unstable-context-value
    <BlogpostCardContext value={{ blogpost: { ...blogpost, date: blogpost.date || new Date() } }}>
      {children}
    </BlogpostCardContext>
  )
}

interface BlogpostCardProps {
  blogpost: Omit<Blogpost, 'date'> & { date?: Date }
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
  containerSize?: 'sm' | 'md' | 'lg'
  children?: React.ReactNode
  className?: string
  showHeader?: boolean
}

export function BlogpostCardFrame({ variants, containerSize = 'md', children, className, showHeader = false, ...props }: BlogpostCardFrameProps) {
  return (
    <motion.div
      className={cn(
        'relative flex flex-col min-h-[200px] rounded-lg overflow-hidden cursor-pointer group',
        className,
      )}
      variants={variants}
      initial="hidden"
      animate="visible"
      {...props}
    >
      {showHeader && (
        <>
          <BlogpostCard.Header className={cn('absolute z-10 pointer-events-none peer')}>
            <BlogpostCard.Title className={cn(
              containerSize === 'lg' ? 'text-2xl' : containerSize === 'md' ? 'text-xl' : 'text-lg',
            )}
            />
            <BlogpostCard.Snippet />
            <BlogpostCard.Date />
          </BlogpostCard.Header>
          <BlogpostCard.Image />
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

interface BlogpostCardTitleProps extends HTMLMotionProps<'h3'> {}

export function BlogpostCardTitle({ className }: BlogpostCardTitleProps) {
  const { blogpost } = useBlogpostCardContext()
  return (
    <motion.h3 className={cn('text-foreground text-2xl font-bold group-hover:text-foreground/70 transition', className)}>
      {blogpost.title}
    </motion.h3>
  )
}

export function BlogpostCardSnippet() {
  const { blogpost } = useBlogpostCardContext()
  return (
    <motion.p className="text-foreground/70 text-base">{blogpost.snippet}</motion.p>
  )
}

interface BlogpostCardDateProps {
  overrideDate?: Date
}

export function BlogpostCardDate({ overrideDate }: BlogpostCardDateProps) {
  const { blogpost } = useBlogpostCardContext()
  const date = overrideDate ? formatDate(overrideDate) : formatDate(blogpost.date)

  return (
    <p className="text-sm text-muted-foreground">{date}</p>
  )
}

interface BlogpostCardImageProps {
  className?: string
  overlayClassName?: string
}

export function BlogpostCardImage({ className, overlayClassName }: BlogpostCardImageProps) {
  const { blogpost } = useBlogpostCardContext()

  return (
    <motion.div className={cn('absolute insert-0 h-full w-full transition-all duration-300 group-hover:scale-105', className)}>
      <Image
        src={blogpost.image}
        alt={blogpost.title}
        fill
        className="object-cover"
      />
      <div className={cn('absolute inset-0 bg-background/80 z-5 hover:bg-background/50 transition duration-400', overlayClassName)} />
    </motion.div>
  )
}

BlogpostCard.displayName = 'BlogpostCard'
BlogpostCard.Frame = BlogpostCardFrame
BlogpostCard.Header = BlogpostCardHeader
BlogpostCard.Title = BlogpostCardTitle
BlogpostCard.Snippet = BlogpostCardSnippet
BlogpostCard.Date = BlogpostCardDate
BlogpostCard.Image = BlogpostCardImage
