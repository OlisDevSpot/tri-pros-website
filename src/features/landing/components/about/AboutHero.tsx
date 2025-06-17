"use client";

import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";

export default function AboutHero() {
  return (
    <section className="relative pt-28 pb-16 lg:pb-24 bg-gradient-to-br overflow-hidden min-h-screen flex items-center justify-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Three Generations of{" "}
                <span className="text-secondary">Master Craftsmanship</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl text-muted-foreground leading-relaxed"
            >
              Founded in 1998 by master craftsman Robert Elite, our company has
              been built on a foundation of unwavering commitment to quality,
              innovation, and client satisfaction. Today, we continue this
              legacy of excellence with the next generation of skilled artisans
              and modern techniques.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="grid grid-cols-3 gap-6 pt-6"
            >
              <div className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-muted-foreground mb-2">
                  1998
                </div>
                <div className="text-sm text-muted-foreground">Founded</div>
              </div>
              <div className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-muted-foreground mb-2">
                  500+
                </div>
                <div className="text-sm text-muted-foreground">Projects</div>
              </div>
              <div className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-muted-foreground mb-2">
                  3
                </div>
                <div className="text-sm text-muted-foreground">Generations</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <motion.div>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="text-lg h-16"
                >
                  <Link href="/contact">Meet Our Team</Link>
                </Button>
              </motion.div>
              <motion.div>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="text-lg h-16"
                >
                  <Link href="/portfolio">View Our Legacy</Link>
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative h-full"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl h-full">
              <Image
                src="/hero-photos/modern-house-2.png"
                alt="Elite Construction founder and team"
                width={600}
                height={700}
                className="object-cover h-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>

            {/* Floating Stats Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="absolute -bottom-6 -left-6 bg-white rounded-xl p-10 shadow-xl border border-border/20"
            >
              <div className="text-center">
                <div className="text-4xl font-bold text-secondary mb-1">
                  25+
                </div>
                <div className="text-lg text-secondary">
                  Years of Excellence
                </div>
              </div>
            </motion.div>

            {/* Floating Award Card */}
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="absolute -top-6 -right-6 bg-white text-secondary rounded-xl p-10 shadow-xl"
            >
              <div className="text-center">
                <div className="text-2xl font-bold mb-1">A+ BBB</div>
                <div className="text-base">Rating</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
