"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Logo from "../Logo";
import { useIsScrolled } from "@/hooks/useIsScrolled";
import { MobileNav } from "./mobile-nav";
import { usePathname } from "next/navigation";

const navigationItems = [
  { name: "About", href: "/about" },
  { name: "Services", href: "/services" },
  { name: "Portfolio", href: "/portfolio" },
  { name: "Blog", href: "/blog" },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const scrolled = useIsScrolled(10);
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={cn(
        "fixed left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "bg-background/95 shadow-lg" : "bg-transparent"
      )}
      style={{
        top: scrolled ? "0" : "16px",
        height: scrolled ? "auto" : "auto",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Logo scrolled={scrolled} />
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navigationItems.map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "relative hover:text-neutral-300 transition-colors duration-200 font-medium",
                    scrolled ? "text-foreground" : "text-foreground",
                    isActive(item.href) ? "text-primary-light" : ""
                  )}
                >
                  {item.name}
                  <motion.div
                    className="absolute -bottom-1 left-0 h-0.5 bg-secondary"
                    initial={{ width: 0 }}
                    whileHover={{ width: "100%" }}
                    transition={{ duration: 0.2 }}
                  />
                </Link>
              </motion.div>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden lg:flex items-center space-x-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href="/contact"
                className="bg-linear-to-r from-primary to-primary-dark text-secondary-foreground px-6 py-3 rounded-lg font-semibold hover:brightness-90 duration-200 transition-all"
              >
                Schedule Consultation
              </Link>
            </motion.div>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            <motion.div
              animate={isOpen ? "open" : "closed"}
              className="w-6 h-6 flex flex-col justify-center items-center"
            >
              <motion.span
                variants={{
                  closed: { rotate: 0, y: 0 },
                  open: { rotate: 45, y: 5 },
                }}
                className="w-6 h-0.5 bg-foreground block transition-all duration-300"
              />
              <motion.span
                variants={{
                  closed: { opacity: 1 },
                  open: { opacity: 0 },
                }}
                className="w-6 h-0.5 bg-foreground block mt-1 transition-all duration-300"
              />
              <motion.span
                variants={{
                  closed: { rotate: 0, y: 0 },
                  open: { rotate: -45, y: -5 },
                }}
                className="w-6 h-0.5 bg-foreground block mt-1 transition-all duration-300"
              />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        navigationItems={navigationItems}
      />
    </motion.nav>
  );
}
