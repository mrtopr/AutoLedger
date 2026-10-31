import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#C81E1E] text-white shadow-2xs hover:bg-[#A81818]",
        secondary:
          "border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200",
        destructive:
          "border-transparent bg-red-500 text-white shadow-2xs hover:bg-red-600",
        outline: "text-slate-700 border-slate-300",
        // Credit status variants matching rules
        green:
          "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_0_8px_rgba(16,185,129,0.25)]",
        yellow:
          "border-amber-200 bg-amber-50 text-amber-700 shadow-[0_0_8px_rgba(245,158,11,0.25)]",
        red:
          "border-red-200 bg-red-50 text-red-700 shadow-[0_0_8px_rgba(239,68,68,0.25)]",
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

