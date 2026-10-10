import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { ChevronDown } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton", className)} {...props} />;
}

export function Badge({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "primary" | "success" | "accent" | "dark" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    primary: "bg-primary-soft text-primary-dark",
    success: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/15",
    accent: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/15",
    dark: "bg-night text-white",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)} {...props} />;
}

export function RangeSlider({
  min,
  max,
  step,
  value,
  onValueChange,
  onValueCommit,
  labels,
}: {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onValueChange: (v: [number, number]) => void;
  onValueCommit: (v: [number, number]) => void;
  labels: [string, string];
}) {
  return (
    <SliderPrimitive.Root
      min={min}
      max={max}
      step={step}
      value={value}
      minStepsBetweenThumbs={1}
      onValueChange={(v) => onValueChange([v[0]!, v[1]!])}
      onValueCommit={(v) => onValueCommit([v[0]!, v[1]!])}
      className="relative flex h-6 w-full touch-none select-none items-center"
    >
      <SliderPrimitive.Track className="relative h-1.5 grow rounded-full bg-slate-200">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
      </SliderPrimitive.Track>
      {labels.map((label, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label={label}
          className="block h-5 w-5 rounded-full border-2 border-primary bg-white shadow-md transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export function Collapsible({ title, defaultOpen = false, children, count }: { title: ReactNode; defaultOpen?: boolean; children: ReactNode; count?: number }) {
  return (
    <CollapsiblePrimitive.Root defaultOpen={defaultOpen}>
      <CollapsiblePrimitive.Trigger className="group flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left text-sm font-medium text-ink hover:bg-slate-50">
        <span>
          {title}
          {count ? <span className="ml-1.5 text-xs text-muted tabular-nums">({count})</span> : null}
        </span>
        <ChevronDown className="h-4 w-4 text-muted transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content className="pl-3 pt-0.5">{children}</CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
}
