import { motion, useReducedMotion } from "framer-motion";

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${8 + (i * 17) % 84}%`,
  top: `${12 + (i * 23) % 76}%`,
  size: 2 + (i % 3),
  duration: 10 + (i % 5) * 2,
  delay: (i % 7) * 0.4,
}));

export function HeroBackground() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="landing-gradient-mesh absolute inset-0" />
      <div className="hero-grid-pattern absolute inset-0 opacity-[0.35]" />

      {/* Radial light orbs */}
      <motion.div
        className="absolute -top-[20%] left-[10%] h-[520px] w-[520px] rounded-full bg-sky-400/25 blur-[100px]"
        animate={reducedMotion ? undefined : { x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[30%] -right-[10%] h-[480px] w-[480px] rounded-full bg-blue-500/20 blur-[100px]"
        animate={reducedMotion ? undefined : { x: [0, -30, 0], y: [0, 40, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute bottom-[10%] left-[30%] h-[400px] w-[400px] rounded-full bg-cyan-300/20 blur-[90px]"
        animate={reducedMotion ? undefined : { x: [0, 25, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Soft center glow behind video column */}
      <div className="absolute top-1/2 right-[5%] h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-primary/10 blur-[80px] hidden lg:block" />

      {/* Floating particles */}
      {!reducedMotion &&
        PARTICLES.map(({ id, left, top, size, duration, delay }) => (
          <motion.span
            key={id}
            className="absolute rounded-full bg-primary/25"
            style={{ left, top, width: size, height: size }}
            animate={{ y: [0, -18, 0], opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
          />
        ))}
    </div>
  );
}
