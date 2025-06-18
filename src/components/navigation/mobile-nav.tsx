import { AnimatePresence } from "motion/react";
import { motion } from "motion/react";
import Link from "next/link";

interface MobileNavProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  navigationItems: { name: string; href: string }[];
}

export const MobileNav = ({
  isOpen,
  setIsOpen,
  navigationItems,
}: MobileNavProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="absolute top-full w-full lg:hidden bg-background/70 backdrop-blur-md border-t"
        >
          <div className="px-4 py-4 space-y-4 flex flex-col items-center">
            {navigationItems.map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  href={item.href}
                  className="block text-foreground hover:text-secondary transition-colors duration-200 font-medium py-2"
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: navigationItems.length * 0.1 }}
              className="pt-4 space-y-3 w-full"
            >
              <Link
                href="/contact"
                className="block bg-primary text-secondary-foreground px-6 py-3 rounded-lg font-semibold text-center"
                onClick={() => setIsOpen(false)}
              >
                Schedule Consultation
              </Link>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
