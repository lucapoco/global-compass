import { motion, useInView, type HTMLMotionProps } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fadeUp, staggerContainer } from "../../motion/variants";

interface FadeInViewProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  stagger?: boolean;
  once?: boolean;
  amount?: number;
}

export function FadeInView({
  children,
  className,
  stagger = false,
  once = true,
  amount = 0.2,
  ...props
}: FadeInViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={stagger ? staggerContainer : fadeUp}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface FadeInItemProps {
  children: ReactNode;
  className?: string;
  index?: number;
}

export function FadeInItem({ children, className, index = 0 }: FadeInItemProps) {
  return (
    <motion.div custom={index} variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}
