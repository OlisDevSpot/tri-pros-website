import { TextWithLine } from '@/shared/components/text-with-line'
import { blogPostTitles } from '@/features/landing/data/blog'
import { BlogpostCard } from './blogpost-card-small'

export function BlogpostsSection() {
  return (
    <section className="w-full min-h-screen py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="flex flex-col gap-4 flex-3">
            {/* LEFT SECTION */}
            <div className="flex flex-col gap-4">
              <TextWithLine text="Our Latest Posts" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {blogPostTitles.map((title, index) => (
                <BlogpostCard
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  title={title}
                  description="cool post bro"
                  image="/hero-photos/modern-house-1.png"
                  date={new Date()}
                />
              ))}
            </div>
          </div>
          {/* RIGHT SECTION */}
          <div className="w-full h-full flex-1">
            <TextWithLine text="Get in touch" />
          </div>
        </div>
      </div>
    </section>
  )
}
