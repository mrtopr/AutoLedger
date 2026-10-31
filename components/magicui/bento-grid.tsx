import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export const BentoGrid = ({ children, className }: BentoGridProps) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-1 md:grid-cols-3 gap-4",
        className
      )}
    >
      {children}
    </div>
  );
};

export interface BentoCardProps {
  name: string;
  className?: string;
  background?: ReactNode;
  Icon?: React.ElementType;
  description: string;
  href?: string;
  cta?: string;
  children?: ReactNode;
}

export const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  children,
}: BentoCardProps) => (
  <div
    key={name}
    className={cn(
      "group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-white p-6 shadow-subtle transition-all duration-300 hover:shadow-elevated dark:border-slate-800 dark:bg-slate-900",
      className
    )}
  >
    {background && (
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-80 transition-opacity duration-300 group-hover:opacity-100">
        {background}
      </div>
    )}

    <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1 transition-all duration-300 group-hover:-translate-y-1">
      {Icon && (
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-700 transition-colors duration-300 group-hover:bg-red-50 group-hover:border-red-200 group-hover:text-[#C81E1E] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900 tracking-tight dark:text-slate-100">
        {name}
      </h3>
      <p className="max-w-md text-xs text-slate-500 leading-relaxed dark:text-slate-400">
        {description}
      </p>
      {children}
    </div>

    {cta && (
      <div className="z-10 mt-4 flex items-center">
        <a
          href={href || "#"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C81E1E] hover:text-[#A81818] transition-colors"
        >
          <span>{cta}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
        </a>
      </div>
    )}
  </div>
);

