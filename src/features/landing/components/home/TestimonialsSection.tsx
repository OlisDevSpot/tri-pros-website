"use client";

import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import Image from "next/image";
import { testimonials } from "@/features/landing/data/testimonials";
import { companyInfo } from "@/features/landing/data/company-info";
import millify from "millify";
import DecorativeLine from "@/components/DecorativeLine";

export default function TestimonialsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <motion.span
        key={i}
        initial={{ opacity: 0, scale: 0 }}
        animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
        transition={{ duration: 0.3, delay: i * 0.1 }}
        className={`text-xl ${i < rating ? "text-yellow-500" : "text-gray-300"}`}
      >
        ★
      </motion.span>
    ));
  };

  const stats = [
    {
      label: "Projects Completed",
      value: `${companyInfo.numProjects}+`,
    },
    {
      label: "Years Experience",
      value: `${new Date().getFullYear() - companyInfo.yearFounded}`,
    },
    {
      label: "Client Satisfaction",
      value: `${companyInfo.clientSatisfaction * 100}%`,
    },
    {
      label: "Projects Delivered",
      value: `$${millify(companyInfo.projectsDelivered, { precision: 0 })}+`,
    },
  ];

  return (
    <section
      ref={ref}
      className="py-20 lg:py-32"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            What Our <span className="text-primary">Clients</span> Say
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Don&apos;t just take our word for it. Hear from the discerning
            homeowners and business owners who trusted us with their most
            important projects.
          </p>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={
                isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }
              }
              transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
              className="text-center"
            >
              <div className="text-3xl lg:text-4xl font-bold text-foreground mb-2">
                {stat.value}
              </div>
              <div className="text-muted-foreground font-medium">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="group"
            >
              <motion.div
                whileHover={{ y: -5 }}
                transition={{ duration: 0.3 }}
                className="bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 h-full border border-border/50 flex flex-col"
              >
                {/* Quote Icon */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={
                    isInView
                      ? { opacity: 1, scale: 1 }
                      : { opacity: 0, scale: 0 }
                  }
                  transition={{ duration: 0.5, delay: index * 0.2 + 0.2 }}
                  className="text-6xl text-foreground/50 font-serif mb-4"
                >
                  &ldquo;
                </motion.div>

                {/* Rating */}
                <div className="flex items-center mb-4">
                  {renderStars(testimonial.rating)}
                </div>

                {/* Testimonial Text */}
                <p className="text-muted-foreground leading-relaxed mb-6 italic flex-grow">
                  {testimonial.text}
                </p>

                {/* Client Info */}
                <div className="flex items-center space-x-4 mt-4">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Image
                      src={testimonial.image}
                      alt={testimonial.name}
                      width={60}
                      height={60}
                      className="rounded-full object-cover size-16 object-center"
                    />
                  </motion.div>
                  <div>
                    <h4 className="font-semibold text-foreground">
                      {testimonial.name}
                    </h4>
                    <p className="text-muted-foreground text-sm font-medium">
                      {testimonial.project}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {testimonial.location}
                    </p>
                  </div>
                </div>

                {/* Decorative Element */}
                <DecorativeLine
                  animate={isInView ? { width: "100%" } : { width: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.2 + 0.5 }}
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
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join 500+ satisfied homeowners who chose excellence.
            <span className="font-semibold text-muted-foreground">
              {" "}
              Limited project slots available for 2024.
            </span>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <a
                href="/testimonials"
                className="inline-flex items-center space-x-2 bg-primary text-primary-foreground px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors duration-200"
              >
                <span>Read More Reviews</span>
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  →
                </motion.span>
              </a>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <a
                href="/contact"
                className="inline-flex items-center space-x-2 border-2 border-secondary text-secondary px-8 py-4 rounded-lg font-semibold text-lg hover:bg-secondary hover:text-secondary-foreground transition-colors duration-200"
              >
                <span>Start Your Project</span>
              </a>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
