'use client'

import { motion, useInView } from 'motion/react'

import { useRef } from 'react'
import DecorativeLine from '@/components/DecorativeLine'
import { credentials } from '@/features/landing/data/company/credentials'
import { stats } from '@/features/landing/data/company/stats'

export default function CredentialsSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

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
            Our
            {' '}
            <span className="text-secondary">Credentials</span>
            {' '}
            &
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
              className="bg-gradient-to-br from-secondary/15 to-secondary/25 rounded-xl p-6 text-center"
            >
              <div className="text-3xl lg:text-4xl font-bold text-foreground mb-2">
                {stat.number}
              </div>
              <div className="font-bold text-muted-foreground mb-1">
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
              className="bg-card rounded-2xl p-8 shadow-lg border border-border/20 hover:shadow-xl transition-shadow duration-300"
            >
              {/* Header */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center">
                  <span className="text-3xl">{credential.icon}</span>
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-foreground">
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
              <DecorativeLine
                animate={isInView ? { width: '100%' } : { width: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 + 0.6 }}
              />
            </motion.div>
          ))}
        </div>

        {/* Verification Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 bg-gradient-to-br from-blue-900 to-neutral-950 rounded-2xl p-8 lg:p-12 text-center text-primary-foreground"
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
  )
}
