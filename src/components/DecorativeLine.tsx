import { motion, TargetAndTransition, Transition } from "framer-motion";

interface DecorativeLineProps {
  animate: TargetAndTransition;
  transition: Transition;
}

export default function DecorativeLine({
  animate,
  transition,
}: DecorativeLineProps) {
  return (
    <motion.div
      initial={{ width: 0 }}
      animate={animate}
      transition={transition}
      className="h-1 bg-gradient-to-r from-secondary to-secondary/50 mx-auto mt-6 rounded-full"
    />
  );
}
