import * as DialogPrimitive from "@radix-ui/react-dialog";
import { m } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OverlayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** "modal" is a centred dialog (20px radius); "sheet" slides in from the right with a spring. */
  variant?: "modal" | "sheet";
  hideTitle?: boolean;
  className?: string;
}

/**
 * Entrance: Framer Motion (spring for the sheet, eased fade/rise for the modal).
 * Exit: CSS keyframes (see index.css). Radix waits for the exit animation to end and then unmounts,
 * so nothing is left behind in the DOM (an invisible overlay would otherwise block the page).
 */
export function OverlayDialog({ open, onOpenChange, title, description, children, variant = "modal", hideTitle, className }: OverlayDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dlg-overlay fixed inset-0 z-50 bg-night/55 backdrop-blur-[2px]" />
        {variant === "modal" ? (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <DialogPrimitive.Content asChild>
              <m.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "dlg-modal pointer-events-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-modal bg-surface shadow-2xl outline-none sm:rounded-modal",
                  className,
                )}
              >
                <DialogHeader title={title} description={description} hideTitle={hideTitle} />
                {children}
              </m.div>
            </DialogPrimitive.Content>
          </div>
        ) : (
          <DialogPrimitive.Content asChild>
            <m.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className={cn("dlg-sheet fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-surface shadow-2xl outline-none", className)}
            >
              <DialogHeader title={title} description={description} hideTitle={hideTitle} />
              {children}
            </m.div>
          </DialogPrimitive.Content>
        )}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DialogHeader({ title, description, hideTitle }: { title: string; description?: string; hideTitle?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <DialogPrimitive.Title className={cn("font-display text-lg font-bold tracking-tight", hideTitle && "sr-only")}>{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
      </div>
      <DialogPrimitive.Close
        aria-label="Close"
        className="-mr-2 flex h-11 w-11 shrink-0 sm:-mr-1.5 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-ink"
      >
        <X className="h-5 w-5" aria-hidden />
      </DialogPrimitive.Close>
    </div>
  );
}
