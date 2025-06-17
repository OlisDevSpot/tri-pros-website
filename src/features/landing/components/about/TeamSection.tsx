"use client";

import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import Image from "next/image";

const teamMembers = [
  {
    name: "Robert Elite",
    position: "Founder & CEO",
    bio: "Master craftsman with over 35 years of experience. Robert founded Elite Construction with a vision to create architectural masterpieces that stand the test of time.",
    specializations: [
      "Luxury Construction",
      "Project Leadership",
      "Quality Assurance",
    ],
    image: "/api/placeholder/300/400",
    email: "robert@eliteconstruction.com",
  },
  {
    name: "Michael Elite",
    position: "President & Head of Operations",
    bio: "Second-generation leader bringing modern innovation to traditional craftsmanship. Michael oversees all construction operations and client relationships.",
    specializations: [
      "Operations Management",
      "Client Relations",
      "Technology Integration",
    ],
    image: "/api/placeholder/300/400",
    email: "michael@eliteconstruction.com",
  },
  {
    name: "Sarah Elite-Martinez",
    position: "Chief Design Officer",
    bio: "Award-winning architect and designer specializing in luxury residential and commercial projects. Sarah leads our design-build initiatives.",
    specializations: [
      "Architectural Design",
      "Interior Design",
      "Sustainable Building",
    ],
    image: "/api/placeholder/300/400",
    email: "sarah@eliteconstruction.com",
  },
  {
    name: "James Thompson",
    position: "Master Carpenter & Foreman",
    bio: "30+ years of fine carpentry and construction expertise. James leads our on-site teams and ensures every detail meets our exacting standards.",
    specializations: ["Fine Carpentry", "Team Leadership", "Quality Control"],
    image: "/api/placeholder/300/400",
    email: "james@eliteconstruction.com",
  },
  {
    name: "Maria Rodriguez",
    position: "Project Manager",
    bio: "Licensed project management professional with expertise in large-scale residential and commercial construction projects.",
    specializations: ["Project Management", "Scheduling", "Budget Control"],
    image: "/api/placeholder/300/400",
    email: "maria@eliteconstruction.com",
  },
  {
    name: "David Kim",
    position: "Head of Business Development",
    bio: "Strategic business leader focused on expanding our reach while maintaining our commitment to quality and client satisfaction.",
    specializations: [
      "Business Strategy",
      "Client Acquisition",
      "Partnership Development",
    ],
    image: "/api/placeholder/300/400",
    email: "david@eliteconstruction.com",
  },
];

export default function TeamSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      className="py-20 lg:py-32 bg-gradient-to-br from-muted/30 to-white"
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
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300"
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
                      className="w-full h-80 object-cover"
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
                <div className="p-6">
                  <h3 className="font-serif text-xl font-bold text-primary mb-1">
                    {member.name}
                  </h3>
                  <p className="text-secondary font-semibold mb-3">
                    {member.position}
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                    {member.bio}
                  </p>

                  {/* Specializations */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-primary">
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
                  <motion.div
                    initial={{ width: 0 }}
                    animate={isInView ? { width: "100%" } : { width: 0 }}
                    transition={{ duration: 0.8, delay: index * 0.1 + 0.5 }}
                    className="h-1 bg-gradient-to-r from-secondary to-primary mt-4 rounded-full"
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
          className="mt-16 bg-primary rounded-2xl p-8 lg:p-12 text-center text-primary-foreground"
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
          <h3 className="font-serif text-2xl font-bold text-primary mb-4">
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
