"use client";

import { motion } from "motion/react";
import Image from "next/image";

export default function ServicesHero() {
  return (
    <section className="relative pt-20 pb-16 lg:pb-24 overflow-hidden h-screen flex items-center">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/hero-photos/modern-house-3.avif"
          alt="Elite Construction services showcase"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/40" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-white space-y-8 mt-16"
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Complete Construction{" "}
                <span className="text-primary">Solutions</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl text-gray-200 leading-relaxed"
            >
              From luxury custom homes to commercial masterpieces, we deliver
              exceptional construction services tailored to your vision and
              budget.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="grid grid-cols-2 gap-6"
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-secondary mb-2">4</div>
                <div className="text-sm text-gray-300">Core Services</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-secondary mb-2">
                  100+
                </div>
                <div className="text-sm text-gray-300">Service Areas</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <motion.a
                href="/contact"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-secondary text-secondary-foreground px-8 py-4 rounded-lg font-semibold text-lg hover:bg-secondary/90 transition-colors duration-200 text-center"
              >
                Get Service Quote
              </motion.a>
              <motion.a
                href="/portfolio"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary transition-colors duration-200 text-center"
              >
                View Our Work
              </motion.a>
            </motion.div>
          </motion.div>

          {/* Service Icons */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-2 gap-6"
          >
            {[
              {
                icon: "🏠",
                title: "Custom Homes",
                subtitle: "Luxury residential",
              },
              {
                icon: "🔨",
                title: "Renovations",
                subtitle: "Complete makeovers",
              },
              {
                icon: "🏢",
                title: "Commercial",
                subtitle: "Business buildings",
              },
              { icon: "📐", title: "Design-Build", subtitle: "Full-service" },
            ].map((service, index) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 + 0.8 }}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center text-white border border-white/20"
              >
                <div className="text-4xl mb-3">{service.icon}</div>
                <h3 className="font-bold text-lg mb-1">{service.title}</h3>
                <p className="text-sm text-gray-300">{service.subtitle}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
