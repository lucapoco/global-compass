/**
 * Button — core interactive button component (shadcn/ui extended).
 *
 * Extended from the shadcn/ui base with:
 *  • Consistent transition timing (duration-normal, ease-out)
 *  • Active press scale effect (press-effect)
 *  • Refined focus-visible ring (3-px ring with offset)
 *  • Loading state variant
 *  • Additional size: "xs" for very compact UI
 *  • Icon-only size: "icon" and "icon-sm"
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "select-none cursor-pointer",
    "transition-[color,background-color,border-color,box-shadow,transform,opacity]",
    "duration-[120ms] ease-[cubic-bezier(0,0,0.2,1)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-45",
    "active:scale-[0.97]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground shadow-sm",
          "hover:bg-primary/88 hover:shadow-md",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground shadow-sm",
          "hover:bg-destructive/88 hover:shadow-md",
        ].join(" "),
        outline: [
          "border border-border bg-card text-foreground",
          "hover:bg-muted hover:border-border",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground",
          "hover:bg-secondary/70",
        ].join(" "),
        ghost: [
          "text-muted-foreground",
          "hover:bg-muted hover:text-foreground",
        ].join(" "),
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
        /* Intelligence platform accents */
        intel: [
          "border border-primary/30 bg-primary/10 text-primary",
          "hover:bg-primary/18 hover:border-primary/50",
        ].join(" "),
        danger: [
          "border border-rose-glow/30 bg-rose-glow/10 text-rose-glow",
          "hover:bg-rose-glow/18 hover:border-rose-glow/50",
        ].join(" "),
      },
      size: {
        xs:      "h-7 rounded-md px-2 text-[11px] [&_svg]:size-3",
        sm:      "h-8 rounded-md px-3 text-xs [&_svg]:size-3.5",
        default: "h-9 rounded-lg px-4 text-sm [&_svg]:size-4",
        lg:      "h-10 rounded-lg px-6 text-sm [&_svg]:size-4",
        xl:      "h-11 rounded-xl px-8 text-base [&_svg]:size-5",
        icon:    "h-9 w-9 rounded-lg [&_svg]:size-4",
        "icon-sm": "h-7 w-7 rounded-md [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled ?? loading}
        aria-disabled={disabled ?? loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <span
              className="h-4 w-4 rounded-full border border-current border-t-transparent animate-spin opacity-70 flex-shrink-0"
              aria-hidden="true"
            />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
