"use client";

import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import Image from "next/image";
import DecorativeLine from "@/components/DecorativeLine";
import { teamMembers } from "../../data/team-members";

export default function TeamSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

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
            Meet Our <span className="text-secondary">Expert Team</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Behind every exceptional project is a team of dedicated
            professionals committed to excellence, innovation, and client
            satisfaction.
          </p>
        </motion.div>

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {teamMembers.map((member, index) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group"
            >
              <motion.div
                whileHover={{ y: -5 }}
                transition={{ duration: 0.3 }}
                className="bg-card rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 h-full flex flex-col"
              >
                {/* Image */}
                <div className="relative overflow-hidden">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Image
                      src={member.image}
                      alt={member.name}
                      width={300}
                      height={400}
                      className="w-full h-80 object-cover object-top"
                    />
                  </motion.div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Contact Overlay */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileHover={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100"
                  >
                    <a
                      href={`mailto:${member.email}`}
                      className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg font-semibold text-center block hover:bg-secondary/90 transition-colors duration-200"
                    >
                      Contact {member.name.split(" ")[0]}
                    </a>
                  </motion.div>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="font-serif text-xl font-bold text-foreground mb-1">
                    {member.name}
                  </h3>
                  <p className="text-muted-foreground font-bold mb-3">
                    {member.position}
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-grow">
                    {member.bio}
                  </p>

                  {/* Specializations */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      Specializations:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {member.specializations.map((spec, specIndex) => (
                        <motion.span
                          key={spec}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={
                            isInView
                              ? { opacity: 1, scale: 1 }
                              : { opacity: 0, scale: 0.8 }
                          }
                          transition={{
                            duration: 0.3,
                            delay: index * 0.1 + specIndex * 0.1,
                          }}
                          className="bg-secondary/10 text-secondary text-xs px-2 py-1 rounded-full font-medium"
                        >
                          {spec}
                        </motion.span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom border animation */}
                  <DecorativeLine
                    animate={isInView ? { width: "100%" } : { width: 0 }}
                    transition={{ duration: 0.8, delay: index * 0.1 + 0.5 }}
                  />
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Team Stats */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-16 bg-linear-to-br from-blue-900 to-neutral-950 rounded-2xl p-8 lg:p-12 text-center text-primary-foreground"
        >
          <h3 className="font-serif text-2xl lg:text-3xl font-bold mb-8">
            Our Team by the Numbers
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-secondary mb-2">
                25+
              </div>
              <div className="text-sm">Team Members</div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-secondary mb-2">
                150+
              </div>
              <div className="text-sm">Years Combined Experience</div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-secondary mb-2">
                15+
              </div>
              <div className="text-sm">Licensed Professionals</div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-secondary mb-2">
                98%
              </div>
              <div className="text-sm">Employee Retention Rate</div>
            </div>
          </div>
        </motion.div>

        {/* Join Our Team CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="text-center mt-16"
        >
          <h3 className="font-serif text-2xl font-bold text-foreground mb-4">
            Join Our Elite Team
          </h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            We&apos;re always looking for talented professionals who share our
            passion for excellence and commitment to quality craftsmanship.
          </p>
          <motion.a
            href="/careers"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center space-x-2 bg-secondary text-secondary-foreground px-8 py-4 rounded-lg font-semibold text-lg hover:bg-secondary/90 transition-colors duration-200"
          >
            <span>View Open Positions</span>
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              →
            </motion.span>
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
