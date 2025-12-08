import type { Metadata } from 'next'
import BlogHero from '@/features/landing/ui/components/blog/blog-hero'
import { BlogpostsSection } from '@/features/landing/ui/components/blog/blogposts-section'

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Explore our blog for industry insights, expert tips, and the latest news in the world of construction and remodeling.',
}

export default function BlogPage() {
  return (
    <main>
      <BlogHero />
      <BlogpostsSection />
    </main>
  )
}
