"use client";

import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { services } from "@/features/landing/data/services";
import { Button } from "@/components/ui/button";
import ServiceCard from "./ServiceCard";
import { useFeatureStore } from "@/store/useFeatureStore";
import { cn } from "@/lib/utils";

export default function ServicesListScroll() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const { featureInView } = useFeatureStore();

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
          className="text-center"
        >
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Our Construction <span className="text-secondary">Services</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Comprehensive construction solutions backed by 25+ years of
            experience and an unwavering commitment to quality craftsmanship.
          </p>
        </motion.div>

        {/* Services */}
        <div className="space-y-24 flex gap-24 items-start">
          <div className="w-1/2 flex flex-col gap-24 flex-1 py-[50vh]">
            {services.map((service, index) => (
              <ServiceCard
                key={index}
                service={service}
                index={index}
              />
            ))}
          </div>
          <div className="sticky top-0 h-screen flex-1 flex items-center">
            <div className="w-full h-[50vh] relative">
              {services.map((service, index) => (
                <motion.div
                  key={index}
                  className={cn(
                    "h-full absolute inset-0 opacity-0 transition-opacity duration-300",
                    featureInView === service.title && "opacity-100"
                  )}
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                    className="relative rounded-2xl aspect-[16/9] lg:aspect-auto overflow-hidden shadow-xl group-hover:shadow-2xl transition-shadow duration-300 h-full"
                  >
                    <Image
                      src={service.image}
                      alt={service.title}
                      width={600}
                      height={400}
                      className="h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileHover={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute bottom-6 left-6 right-6 opacity-0 group-hover:opacity-100"
                    >
                      <Link
                        href={service.href}
                        className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-semibold text-center block hover:bg-secondary/90 transition-colors duration-200"
                      >
                        Explore {service.title} →
                      </Link>
                    </motion.div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="bg-gradient-to-br from-secondary/20 to-secondary/40 rounded-2xl p-8 lg:p-12 text-center text-primary-foreground"
        >
          <h3 className="font-serif text-2xl lg:text-3xl font-bold mb-6">
            Not Sure Which Service You Need?
          </h3>
          <p className="text-lg mb-8 opacity-90 max-w-3xl mx-auto">
            Our expert team can help you determine the best approach for your
            project. Schedule a free consultation to discuss your vision and get
            personalized recommendations.
          </p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              asChild
              variant="default"
              size="lg"
              className="text-lg h-16"
            >
              <Link
                href="/contact"
                className="inline-flex items-center space-x-2 px-8 py-4 rounded-lg font-semibold text-lg"
              >
                <span>Schedule Free Consultation</span>
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  →
                </motion.span>
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
