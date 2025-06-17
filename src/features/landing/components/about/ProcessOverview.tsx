"use client";

import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";

const processSteps = [
  {
    phase: "Discovery & Planning",
    duration: "Weeks 1-2",
    description:
      "We begin every project with a comprehensive consultation to understand your vision, needs, and budget.",
    activities: [
      "Initial consultation and site assessment",
      "Design development and architectural planning",
      "Permit applications and approvals",
      "Detailed project proposal and timeline",
      "Material selection and sourcing",
    ],
    icon: "🔍",
    bgColor: "from-blue-900 to-neutral-950",
    color: "bg-blue-300",
  },
  {
    phase: "Pre-Construction",
    duration: "Weeks 3-4",
    description:
      "Thorough preparation ensures smooth execution and eliminates surprises during construction.",
    activities: [
      "Final design approval and engineering",
      "Material ordering and delivery scheduling",
      "Subcontractor coordination and scheduling",
      "Site preparation and safety setup",
      "Project timeline finalization",
    ],
    icon: "📋",
    bgColor: "from-orange-900 to-neutral-950",
    color: "bg-orange-300",
  },
  {
    phase: "Construction",
    duration: "Timeline Varies",
    description:
      "Expert execution with daily progress updates and regular quality checkpoints.",
    activities: [
      "Daily progress updates and communication",
      "Regular quality control inspections",
      "Weekly client walkthroughs",
      "Real-time project management",
      "Continuous safety monitoring",
    ],
    icon: "🏗️",
    bgColor: "from-green-900 to-neutral-950",
    color: "bg-green-300",
  },
  {
    phase: "Completion & Handover",
    duration: "Final Week",
    description:
      "Meticulous final inspections and comprehensive warranty documentation ensure your complete satisfaction.",
    activities: [
      "Final quality inspections",
      "Client walkthrough and punch list",
      "System demonstrations and training",
      "Warranty documentation and registration",
      "Project completion celebration",
    ],
    icon: "✅",
    bgColor: "from-purple-900 to-neutral-950",
    color: "bg-purple-300",
  },
];

const qualityMeasures = [
  {
    title: "Daily Quality Checks",
    description:
      "Every aspect of work is inspected daily by our quality control team",
    icon: "🔍",
  },
  {
    title: "Photo Documentation",
    description:
      "Complete photographic record of all work phases for transparency",
    icon: "📸",
  },
  {
    title: "Third-Party Inspections",
    description:
      "Independent inspections at critical milestones ensure compliance",
    icon: "🏛️",
  },
  {
    title: "Material Verification",
    description:
      "All materials verified for quality and specifications before installation",
    icon: "✅",
  },
];

export default function ProcessOverview() {
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
            Our Proven <span className="text-secondary">Process</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            A systematic approach refined over 25 years to ensure exceptional
            results, clear communication, and complete client satisfaction.
          </p>
        </motion.div>

        {/* Process Steps */}
        <div className="space-y-24 mb-20">
          {processSteps.map((step, index) => (
            <motion.div
              key={step.phase}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="relative"
            >
              <div
                className={`grid grid-cols-1 lg:grid-cols-2 items-center ${index % 2 === 0 ? "bg-gradient-to-tr" : "bg-gradient-to-tl"} ${step.bgColor} rounded-lg`}
              >
                {/* Content */}
                <div
                  className={`${index % 2 === 0 ? "lg:order-2" : ""} space-y-6 p-8 h-full relative`}
                >
                  <div className="flex items-center space-x-4">
                    <div>
                      <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {step.duration}
                      </div>
                      <h3 className="font-serif text-2xl lg:text-3xl font-bold text-foreground">
                        {step.phase}
                      </h3>
                    </div>
                  </div>

                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>

                  <div className="space-y-3">
                    {step.activities.map((activity, activityIndex) => (
                      <motion.div
                        key={activity}
                        initial={{ opacity: 0, x: -20 }}
                        animate={
                          isInView
                            ? { opacity: 1, x: 0 }
                            : { opacity: 0, x: -20 }
                        }
                        transition={{
                          duration: 0.4,
                          delay: index * 0.2 + activityIndex * 0.1 + 0.3,
                        }}
                        className="flex items-start space-x-3"
                      >
                        <div className="w-2 h-2 bg-foreground rounded-full flex-shrink-0 mt-2" />
                        <span className="text-muted-foreground">
                          {activity}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Connecting Line */}
                  {index < processSteps.length - 1 && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={isInView ? { height: "200px" } : { height: 0 }}
                      transition={{ duration: 0.8, delay: index * 0.2 + 0.5 }}
                      className="absolute left-1/2 top-full w-1 bg-gradient-to-b from-white to-neutral-500 rounded-full transform -translate-x-1/2 hidden lg:block z-[-1]"
                    />
                  )}
                </div>

                {/* Visual Element */}
                <div
                  className={`${index % 2 === 1 ? "lg:order-1" : ""} h-full shadow-2xl`}
                >
                  <div
                    className={`${step.color} rounded-lg p-8 shadow-xl border border-border/20 h-full flex items-center justify-center`}
                  >
                    <div className="text-center">
                      <div
                        className={`w-24 h-24 bg-gradient-to-br ${step.bgColor} rounded-full flex items-center justify-center text-white text-4xl mx-auto mb-6`}
                      >
                        {step.icon}
                      </div>
                      <div className="text-6xl font-bold text-background/60 mb-2">
                        {index + 1}
                      </div>
                      <div className="font-serif text-xl font-bold text-background">
                        {step.phase}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quality Assurance */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="bg-transparent rounded-2xl p-8 lg:p-12 shadow-xl border border-border"
        >
          <div className="text-center mb-12">
            <h3 className="font-serif text-2xl lg:text-3xl font-bold text-foreground mb-4">
              Quality Assurance Measures
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Our commitment to excellence is backed by rigorous quality control
              processes at every stage of construction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {qualityMeasures.map((measure, index) => (
              <motion.div
                key={measure.title}
                initial={{ opacity: 0, y: 30 }}
                animate={
                  isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
                }
                transition={{ duration: 0.6, delay: index * 0.1 + 0.8 }}
                className="select-none text-center p-6 rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5 hover:from-primary/10 hover:to-secondary/10 transition-colors duration-300"
              >
                <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">{measure.icon}</span>
                </div>
                <h4 className="font-semibold text-foreground mb-2">
                  {measure.title}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {measure.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="text-center mt-16"
        >
          <h3 className="font-serif text-2xl font-bold text-foreground mb-4">
            Ready to Experience Our Process?
          </h3>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Discover how our proven methodology ensures your project exceeds
            expectations from concept to completion.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <motion.a
              href="/process"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-secondary text-secondary-foreground px-8 py-4 rounded-lg font-semibold text-lg hover:bg-secondary/90 transition-colors duration-200"
            >
              Learn More About Our Process
            </motion.a>
            <motion.a
              href="/contact"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="border-2 border-primary text-primary px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
            >
              Start Your Project
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
