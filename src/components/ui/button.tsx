import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-[#E6B0AE]/70 bg-[linear-gradient(90deg,#E3A7A7_0%,#EAB8B3_100%)] text-primary-foreground shadow-[0_10px_24px_rgba(230,176,174,0.28)] hover:border-[#DFA3A2]/80 hover:bg-[#DFA3A2] hover:bg-none hover:shadow-[0_12px_28px_rgba(223,163,162,0.32)] active:border-[#D89695]/80 active:bg-[#D89695] active:bg-none",
        glossy:
          "rounded-[10px] border border-[#c68d8d] bg-[#E3A7A7] bg-[radial-gradient(ellipse_12px_4px_at_calc(100%_-_12px)_6px,rgba(255,255,255,0.85),transparent),linear-gradient(90deg,#E3A7A7_0%,#EAB8B3_100%)] text-white shadow-[inset_0_2px_2px_rgba(255,255,255,0.48),inset_2px_0_4px_rgba(123,68,68,0.24),inset_0_-5px_7px_rgba(123,68,68,0.38),0_2px_3px_rgba(123,68,68,0.2)] hover:brightness-105 active:translate-y-px active:brightness-95",
        secondary: "bg-white border border-border hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-5",
        icon: "h-10 w-10 rounded-full"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
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
