"use client";

import { motion } from "motion/react";

export default function ContactHero() {
  return (
    <section className="relative pt-20 pb-16 lg:pb-24 bg-gradient-to-br from-primary/10 to-secondary/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-primary mb-6">
            Let&apos;s Build Your{" "}
            <span className="text-secondary">Dream Project</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Ready to start your luxury construction journey? Contact our expert
            team for a consultation and discover how we can bring your vision to
            life.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
