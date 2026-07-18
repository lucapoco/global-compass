import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { hoverLift } from "../../motion/variants";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  glow?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, className, hover = false, glow = false, ...props }, ref) => {
    const classes = cn(
      "landing-glass rounded-[24px] border border-white/60 bg-white/70 backdrop-blur-xl",
      "shadow-[0_8px_32px_rgba(15,23,42,0.06)]",
      glow && "landing-glow",
      hover && "cursor-default transition-shadow hover:shadow-[0_20px_48px_rgba(2,132,199,0.12)]",
      className,
    );

    if (hover) {
      return (
        <motion.div
          ref={ref}
          initial="rest"
          whileHover="hover"
          variants={hoverLift}
          className={classes}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  },
);
GlassCard.displayName = "GlassCard";
