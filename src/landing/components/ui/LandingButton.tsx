import { motion } from "framer-motion";
import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LandingButtonProps = ButtonProps & {
  glow?: boolean;
};

export const LandingButton = forwardRef<HTMLButtonElement, LandingButtonProps>(
  ({ className, glow = false, children, asChild, ...props }, ref) => {
    const button = (
      <Button
        ref={ref}
        asChild={asChild}
        className={cn(
          glow && "landing-btn-glow shadow-[0_0_24px_rgba(2,132,199,0.35)] hover:shadow-[0_0_32px_rgba(2,132,199,0.45)]",
          className,
        )}
        {...props}
      >
        {children}
      </Button>
    );

    if (asChild) return button;

    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="inline-flex"
      >
        {button}
      </motion.div>
    );
  },
);
LandingButton.displayName = "LandingButton";
