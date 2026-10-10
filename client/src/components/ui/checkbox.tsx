import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { m } from "framer-motion";
import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CheckboxFieldProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  count?: number;
  className?: string;
}

/** Labelled checkbox with a small spring-scale on selection. */
export function CheckboxField({ checked, onCheckedChange, label, count, className }: CheckboxFieldProps) {
  const id = useId();
  return (
    <div className={cn("group flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-slate-50", className)}>
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-line-strong bg-surface transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary"
      >
        <CheckboxPrimitive.Indicator forceMount asChild>
          <m.span
            initial={false}
            animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 22 }}
            className="flex text-white"
          >
            <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />
          </m.span>
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <label htmlFor={id} className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-sm text-ink">
        <span>{label}</span>
        {count !== undefined && <span className="text-xs tabular-nums text-muted">{count}</span>}
      </label>
    </div>
  );
}
