import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "ruido-label-cutout inline-flex items-center px-2.5 py-1 border-2 font-mono text-xs font-bold tracking-wide uppercase",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-paper border-ink",
        secondary:
          "bg-paper-card text-ink border-ink",
        destructive:
          "bg-punk-red text-white border-ink",
        outline:
          "bg-paper text-ink border-ink hover:bg-punk-acid",
        success:
          "bg-green-800 text-white border-ink",
        warning:
          "bg-punk-acid text-ink border-ink",
        stamp:
          "border-punk-red text-punk-red bg-paper font-heavy tracking-widest text-[13px] px-2.5 py-0.5",
        stampGreen:
          "border-green-800 text-green-800 bg-paper font-heavy tracking-widest text-[13px] px-2.5 py-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
