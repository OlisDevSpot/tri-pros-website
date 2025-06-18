"use client";

import { motion } from "motion/react";
import Image from "next/image";

interface BlogPostCardProps {
  title: string;
  description: string;
  image: string;
  date: Date;
}

export function BlogPostCard({
  title,
  description,
  date,
  image,
}: BlogPostCardProps) {
  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="relative w-full aspect-[9/16] rounded-lg overflow-hidden shadow-sm p-4 hover:shadow-lg cursor-pointer transition-all duration-300">
      <div className="flex flex-col gap-2 justify-end h-full peer z-10 relative">
        <h3 className="text-2xl font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-sm text-muted-foreground">{formattedDate}</p>
      </div>
      <motion.div className="absolute inset-0 h-full w-full hover:scale-105 transition-all duration-300 peer-hover:scale-105">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover"
        />
      </motion.div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />
    </div>
  );
}
