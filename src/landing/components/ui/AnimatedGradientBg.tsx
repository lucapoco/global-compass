import { motion } from "framer-motion";

/** Fundal animat subtil pentru CTA-ul landing. */
export function AnimatedGradientBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="landing-gradient-mesh absolute inset-0" />
      <motion.div
        className="absolute -top-[20%] left-[10%] h-[520px] w-[520px] rounded-full bg-sky-400/25 blur-[100px]"
        animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[30%] -right-[10%] h-[480px] w-[480px] rounded-full bg-blue-500/20 blur-[100px]"
        animate={{ x: [0, -30, 0], y: [0, 40, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute bottom-[10%] left-[30%] h-[400px] w-[400px] rounded-full bg-cyan-300/20 blur-[90px]"
        animate={{ x: [0, 25, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
    </div>
  );
}
