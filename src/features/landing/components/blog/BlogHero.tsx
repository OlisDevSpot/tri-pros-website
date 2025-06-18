"use client";

import { motion, Variants } from "motion/react";

import { blogPostTitles } from "@/features/landing/data/blog";
import { HeroContainer } from "@/components/HeroContainer";
import { HeroBlogPostCard } from "./HeroBlogPostCard";

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
    <HeroContainer>
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
          <HeroBlogPostCard
            data={{
              image: "/hero-photos/modern-house-1.png",
              title: blogPostTitles[0],
              snippet: "This is a modern house",
            }}
            variants={childVariants}
          />
        </motion.div>
        <motion.div className="flex-[1] flex flex-col gap-4 h-full">
          <HeroBlogPostCard
            data={{
              image: "/hero-photos/modern-house-2.png",
              title: blogPostTitles[1],
              snippet: "This is a modern house",
            }}
            variants={childVariants}
          />
          <HeroBlogPostCard
            data={{
              image: "/hero-photos/modern-house-4.webp",
              title: blogPostTitles[2],
              snippet: "This is a modern house",
            }}
            variants={childVariants}
          />
        </motion.div>
      </motion.div>
    </HeroContainer>
  );
}
