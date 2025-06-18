/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

export function PortfolioHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const scaleProgress = useTransform(scrollYProgress, [0, 0.95], [1, 0.8]);
  const rounded = useTransform(scrollYProgress, [0, 0.95], ["0px", "24px"]);

  return (
    <div
      ref={ref}
      className="h-[200vh] w-full"
    >
      <motion.div className="h-screen w-full sticky top-0 overflow-hidden">
        <motion.div
          className="h-full w-full overflow-hidden bg-white"
          style={{ scale: scaleProgress, borderRadius: rounded }}
        >
          <motion.img
            src="/hero-photos/modern-house-1.png"
            alt="Portfolio Hero"
            className="h-full w-full object-cover"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
