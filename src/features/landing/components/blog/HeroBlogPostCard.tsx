import { cn } from "@/lib/utils";
import { HTMLMotionProps, motion, Variants } from "motion/react";
import Image from "next/image";

interface HeroBlogPostCardProps extends HTMLMotionProps<"div"> {
  data: {
    image: string;
    title: string;
    snippet: string;
  };
  className?: string;
  variants: Variants;
}

export function HeroBlogPostCard({
  data,
  className,
  variants,
  ...props
}: HeroBlogPostCardProps) {
  return (
    <motion.div
      className={cn(
        "relative flex justify-end h-full rounded-lg overflow-hidden cursor-pointer",
        className
      )}
      variants={variants}
      {...props}
    >
      {/* CONTENT-- first because we use `peer` which must be earlier than affected sibling*/}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeInOut", delay: 0.3 }}
        className="inset-0 flex flex-col justify-end p-4 z-10 peer"
      >
        <motion.h3 className="text-white text-2xl font-bold">
          {data.title}
        </motion.h3>
        <motion.p className="text-white text-base">{data.snippet}</motion.p>
      </motion.div>

      {/* BG IMAGE */}
      <motion.div className="absolute inset-0 h-full w-full hover:scale-105 transition-all duration-300 peer-hover:scale-105">
        <Image
          src={data.image}
          alt={data.title}
          fill
          className="object-cover"
        />
      </motion.div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />
    </motion.div>
  );
}
