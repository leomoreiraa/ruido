import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ruido-press-cutout ruido-flat-button inline-flex min-h-10 items-center justify-center gap-2 border-[3px] border-ink font-mono text-xs font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "bg-punk-acid text-ink hover:bg-ink hover:text-punk-acid hover:border-punk-acid",
        destructive: "bg-punk-red text-white hover:bg-ink hover:text-white hover:border-punk-red",
        outline: "bg-paper text-ink hover:bg-punk-acid",
        secondary: "bg-ink text-paper border-punk-acid hover:bg-punk-acid hover:text-ink",
        ghost: "border-transparent bg-transparent text-ink hover:border-ink hover:bg-paper-card",
        link: "border-transparent bg-transparent text-punk-red underline underline-offset-4 hover:text-ink",
      },
      size: {
        default: "px-4 py-2",
        sm: "min-h-9 px-3 py-1.5 text-[11px]",
        lg: "min-h-12 px-6 py-3 text-sm",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
