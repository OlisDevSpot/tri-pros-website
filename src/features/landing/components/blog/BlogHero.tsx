"use client";

import { cn } from "@/lib/utils";
import { HTMLMotionProps, motion, Variants } from "motion/react";

import { blogPostTitles } from "@/features/landing/data/blog";

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
      ease: "easeInOut",
      staggerChildren: 0.2,
    },
  },
};

const childVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export default function BlogHero() {
  return (
    <section className="relative pt-20 pb-16 lg:pb-24 bg-gradient-to-br overflow-hidden h-screen flex items-center justify-center">
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-4 h-[80%] w-full"
        variants={parentVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          className="flex-[2] h-full"
          variants={childVariants}
        >
          <HeroBlogPost
            data={{
              image: "/hero-photos/modern-house-1.png",
              title: blogPostTitles[0],
              snippet: "This is a modern house",
            }}
          />
        </motion.div>
        <motion.div className="flex-[1] flex flex-col gap-4 h-full">
          <HeroBlogPost
            data={{
              image: "/hero-photos/modern-house-2.png",
              title: blogPostTitles[1],
              snippet: "This is a modern house",
            }}
          />
          <HeroBlogPost
            data={{
              image: "/hero-photos/modern-house-4.webp",
              title: blogPostTitles[2],
              snippet: "This is a modern house",
            }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}

interface HeroBlogPostProps extends HTMLMotionProps<"div"> {
  data: {
    image: string;
    title: string;
    snippet: string;
  };
}

export function HeroBlogPost({ data, className, ...props }: HeroBlogPostProps) {
  return (
    <motion.div
      className={cn("relative flex justify-end h-full rounded-lg", className)}
      variants={childVariants}
      style={{
        backgroundImage: `url("${data.image}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      {...props}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeInOut", delay: 0.3 }}
        className="inset-0 flex flex-col justify-end p-4 z-10"
      >
        <motion.h3 className="text-white text-2xl font-bold">
          {data.title}
        </motion.h3>
        <motion.p className="text-white text-base">{data.snippet}</motion.p>
      </motion.div>
    </motion.div>
  );
}
