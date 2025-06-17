"use client";

import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";

const credentials = [
  {
    category: "Licenses & Certifications",
    items: [
      "Licensed General Contractor (State of California - License #123456)",
      "NARI Certified Professional (National Association of the Remodeling Industry)",
      "LEED Accredited Professional (Green Building)",
      "OSHA 30-Hour Construction Safety Certification",
      "EPA Lead-Safe Certified",
    ],
    icon: "📋",
  },
  {
    category: "Insurance Coverage",
    items: [
      "General Liability Insurance - $2M Coverage",
      "Workers' Compensation Insurance - Full Coverage",
      "Professional Liability Insurance - $1M Coverage",
      "Bonded for Projects up to $5M",
      "Commercial Auto Insurance",
    ],
    icon: "🛡️",
  },
  {
    category: "Industry Memberships",
    items: [
      "Better Business Bureau (A+ Rating)",
      "National Association of the Remodeling Industry (NARI)",
      "Associated General Contractors of America (AGC)",
      "U.S. Green Building Council (USGBC)",
      "Home Builders Association",
    ],
    icon: "🏛️",
  },
  {
    category: "Awards & Recognition",
    items: [
      "2023 Best Luxury Home Builder - Local Business Awards",
      "2022 Excellence in Construction - AGC Chapter",
      "2021 Customer Choice Award - Home Improvement",
      "2020 Green Building Excellence Award",
      "Multiple Parade of Homes Awards (2018-2023)",
    ],
    icon: "🏆",
  },
];

const stats = [
  { number: "A+", label: "BBB Rating", description: "Accredited since 2001" },
  {
    number: "100%",
    label: "Licensed & Bonded",
    description: "Fully compliant",
  },
  {
    number: "$5M",
    label: "Bonding Capacity",
    description: "Large project coverage",
  },
  { number: "22", label: "Years Accredited", description: "BBB membership" },
];

export default function CredentialsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      className="py-20 lg:py-32 bg-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-6">
            Our <span className="text-secondary">Credentials</span> &
            Recognition
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Trust and reliability backed by industry-leading certifications,
            comprehensive insurance, and prestigious awards.
          </p>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={
                isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }
              }
              transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
              className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl p-6 text-center"
            >
              <div className="text-3xl lg:text-4xl font-bold text-secondary mb-2">
                {stat.number}
              </div>
              <div className="font-semibold text-primary mb-1">
                {stat.label}
              </div>
              <div className="text-sm text-muted-foreground">
                {stat.description}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {credentials.map((credential, index) => (
            <motion.div
              key={credential.category}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="bg-white rounded-2xl p-8 shadow-lg border border-border/20 hover:shadow-xl transition-shadow duration-300"
            >
              {/* Header */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center">
                  <span className="text-3xl">{credential.icon}</span>
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-primary">
                    {credential.category}
                  </h3>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                {credential.items.map((item, itemIndex) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: -20 }}
                    animate={
                      isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }
                    }
                    transition={{
                      duration: 0.4,
                      delay: index * 0.1 + itemIndex * 0.1 + 0.3,
                    }}
                    className="flex items-start space-x-3"
                  >
                    <div className="w-2 h-2 bg-secondary rounded-full flex-shrink-0 mt-2" />
                    <span className="text-muted-foreground leading-relaxed">
                      {item}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Bottom border animation */}
              <motion.div
                initial={{ width: 0 }}
                animate={isInView ? { width: "100%" } : { width: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 + 0.6 }}
                className="h-1 bg-gradient-to-r from-secondary to-primary mt-6 rounded-full"
              />
            </motion.div>
          ))}
        </div>

        {/* Verification Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 bg-gradient-to-br from-primary to-primary/90 rounded-2xl p-8 lg:p-12 text-center text-primary-foreground"
        >
          <h3 className="font-serif text-2xl lg:text-3xl font-bold mb-6">
            Verify Our Credentials
          </h3>
          <p className="text-lg mb-8 opacity-90 max-w-3xl mx-auto">
            We believe in complete transparency. All our licenses,
            certifications, and insurance policies are current and verifiable
            through the appropriate regulatory bodies.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.a
              href="https://www.bbb.org"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 hover:bg-white/20 transition-colors duration-200"
            >
              <div className="text-2xl mb-2">🅱️</div>
              <div className="font-semibold">Verify BBB Rating</div>
              <div className="text-sm opacity-80">Check our A+ rating</div>
            </motion.a>

            <motion.a
              href="https://www.cslb.ca.gov"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 hover:bg-white/20 transition-colors duration-200"
            >
              <div className="text-2xl mb-2">📜</div>
              <div className="font-semibold">License Verification</div>
              <div className="text-sm opacity-80">
                State contractor database
              </div>
            </motion.a>

            <motion.a
              href="/contact"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-secondary text-secondary-foreground rounded-lg p-4 hover:bg-secondary/90 transition-colors duration-200"
            >
              <div className="text-2xl mb-2">📞</div>
              <div className="font-semibold">Request Certificates</div>
              <div className="text-sm opacity-90">
                Get official documentation
              </div>
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
