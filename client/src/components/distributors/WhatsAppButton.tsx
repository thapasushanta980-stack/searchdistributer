import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Opens a WhatsApp chat with the business through the tracked /go/whatsapp redirect (counted in analytics,
 * with a pre-filled message that credits the site). The number itself never appears in the page.
 */
export function WhatsAppButton({ slug, productSlug, className, label = "Chat on WhatsApp" }: { slug: string; productSlug?: string; className?: string; label?: string }) {
  const href = `/go/whatsapp/${slug}${productSlug ? `?product=${encodeURIComponent(productSlug)}` : ""}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener nofollow"
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-button bg-[#128C7E] px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#075E54] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E]",
        className,
      )}
    >
      <MessageCircle className="h-5 w-5" aria-hidden /> {label}
      <span className="sr-only"> (opens WhatsApp)</span>
    </a>
  );
}
