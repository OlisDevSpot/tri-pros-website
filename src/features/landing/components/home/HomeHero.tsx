"use client";

import { motion } from "motion/react";
import Link from "next/link";
import Image from "next/image";
import { companyInfo } from "@/features/landing/data/company-info";
import { Button } from "@/components/ui/button";

export default function HomeHero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/hero-photos/modern-house-1.png"
          alt="Luxury construction project"
          fill
          className="object-cover brightness-50"
          priority
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>
      <div className="absolute inset-0 z-1 bg-gradient-to-b from-transparent via-transparent to-background" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-foreground">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="font-serif text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight"
          >
            Crafting Architectural{" "}
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="bg-gradient-to-r from-secondary to-red-700 bg-clip-text text-transparent font-extrabold"
            >
              Masterpieces
            </motion.span>{" "}
            That Stand the Test of Time
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl sm:text-2xl text-foreground max-w-4xl mx-auto leading-relaxed"
          >
            Premium construction services for discerning homeowners and
            businesses who demand excellence
          </motion.p>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-wrap justify-center items-center gap-8 text-foreground"
          >
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-foreground rounded-full" />
              <span className="font-semibold">
                {new Date().getFullYear() - companyInfo.yearFounded}+ Years
                Experience
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-foreground rounded-full" />
              <span className="font-semibold">
                {companyInfo.numProjects}+ Luxury Homes Built
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-foreground rounded-full" />
              <span className="font-semibold">A+ BBB Rating</span>
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                asChild
                variant="default"
                size="lg"
                className="h-14 text-lg"
              >
                <Link href="/contact">Schedule Your Consultation</Link>
              </Button>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-14 text-lg"
              >
                <Link href="/portfolio">View Our Portfolio</Link>
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white z-10"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center space-y-2"
        >
          <span className="text-sm font-medium">Scroll to explore</span>
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1 h-3 bg-white/70 rounded-full mt-2"
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
