import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-11 w-full rounded-lg border border-foreground/20 bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
