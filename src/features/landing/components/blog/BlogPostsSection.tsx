import { blogPostTitles } from "@/features/landing/data/blog";
import { BlogPostCard } from "./BlogPostCard";

export function BlogPostsSection() {
  return (
    <section className="w-full min-h-screen py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="flex flex-col gap-4 flex-[3]">
            {/* LEFT SECTION */}
            <div className="flex flex-col gap-4">
              <TextWithLine text="Our Latest Posts" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {blogPostTitles.map((title, index) => (
                <BlogPostCard
                  key={index}
                  title={title}
                  description={"cool post bro"}
                  image={"/hero-photos/modern-house-1.png"}
                  date={new Date()}
                />
              ))}
            </div>
          </div>
          {/* RIGHT SECTION */}
          <div className="w-full h-full flex-[1]">
            <TextWithLine text="Get in touch" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function TextWithLine({ text }: { text: string }) {
  return (
    <h2 className="flex uppercase text-2xl min-w-fit font-bold items-center after:h-0.5 after:content-[''] after:flex-grow after:bg-muted-foreground after:flex after:top-1/2 after:-translate-y-1/2 after:left-full after:ml-2">
      {text}
    </h2>
  );
}
