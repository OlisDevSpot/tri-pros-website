"use client";

import { companyInfo } from "@/features/landing/data/company-info";
import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import { valueProps } from "../../data/value-prop";
import { Button } from "@/components/ui/button";

export default function ValuePropositions() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      className="py-20 lg:py-32 bg-gradient-to-br from-transparent to-neutral-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Why {companyInfo.name} Chooses{" "}
            <span className="text-primary">Excellence</span>
            <br />
            Over Everything
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Our unwavering commitment to quality, reliability, and service sets
            us apart in the luxury construction industry.
          </p>
        </motion.div>

        {/* Value Props Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {valueProps.map((prop, index) => (
            <motion.div
              key={prop.title}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="group"
            >
              <motion.div
                whileHover={{ y: -10 }}
                transition={{ duration: 0.3 }}
                className="bg-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 h-full select-none flex flex-col"
              >
                {/* Icon */}
                <motion.div
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  transition={{ duration: 0.3 }}
                  className="text-6xl mb-6 text-center"
                >
                  {prop.icon}
                </motion.div>

                {/* Title */}
                <h3 className="font-serif text-2xl font-bold text-card-foreground mb-4 text-center">
                  {prop.title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground font-semibold text-center mb-4">
                  {prop.description}
                </p>

                {/* Detail */}
                <p className="text-muted-foreground leading-relaxed text-center flex-grow">
                  {prop.detail}
                </p>

                {/* Decorative Element */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={isInView ? { width: "60%" } : { width: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.2 + 0.4 }}
                  className="h-1 bg-gradient-to-r from-secondary to-primary mx-auto mt-6 rounded-full"
                />
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-16"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              className="h-14 text-lg"
              size="lg"
            >
              <span>Learn About Our Process</span>
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.span>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
