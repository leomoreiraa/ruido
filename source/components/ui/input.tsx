import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "ruido-input-cutout flex h-10 w-full border-2 sm:border-3 border-ink bg-white px-3.5 py-2 text-xs font-mono font-bold text-ink shadow-[3px_3px_0_#101010] transition-colors placeholder:text-ink/40 focus-visible:outline-none focus-visible:border-punk-red focus-visible:shadow-[5px_5px_0_#d8f53e] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
