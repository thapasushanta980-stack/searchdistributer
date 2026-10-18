import { m } from "framer-motion";
import { BadgeCheck, Heart, ShieldCheck } from "lucide-react";
import { VERIFICATION_LABELS, type VerificationStatus } from "@sd/shared";
import { Badge } from "@/components/ui/misc";
import { useFavorites } from "@/lib/favorites";
import { cn, initials } from "@/lib/utils";

const TINTS = ["bg-indigo-50 text-indigo-700", "bg-sky-50 text-sky-700", "bg-emerald-50 text-emerald-700", "bg-violet-50 text-violet-700", "bg-amber-50 text-amber-800", "bg-rose-50 text-rose-700"];
const tintFor = (name: string) => TINTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length]!;

export function CompanyLogo({ name, logoUrl, size = 48, className }: { name: string; logoUrl: string | null; size?: number; className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white transition-transform duration-300 group-hover/card:scale-[1.03]", className)}
      style={{ width: size, height: size }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={`${name} logo`} width={size} height={size} loading="lazy" decoding="async" className="h-full w-full object-contain p-1.5" />
      ) : (
        <span aria-hidden className={cn("flex h-full w-full items-center justify-center font-display text-base font-bold", tintFor(name))}>
          {initials(name)}
        </span>
      )}
    </div>
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === "NONE") return null;
  return status === "VERIFIED" ? (
    <Badge tone="success">
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified
    </Badge>
  ) : (
    <Badge tone="primary" title={VERIFICATION_LABELS[status]}>
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Reviewed
    </Badge>
  );
}

export function FavoriteButton({ id, name }: { id: string; name: string }) {
  const { favorites, toggle } = useFavorites();
  const active = favorites.has(id);
  return (
    <m.button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from saved` : `Save ${name}`}
      onClick={() => toggle(id)}
      whileTap={{ scale: 0.82 }}
      className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 sm:h-9 sm:w-9 transition-colors hover:bg-rose-50 hover:text-rose-500 aria-pressed:text-rose-500"
    >
      <m.span key={String(active)} initial={active ? { scale: 0.5 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 12 }} className="flex">
        <Heart className="h-[18px] w-[18px]" fill={active ? "currentColor" : "none"} aria-hidden />
      </m.span>
    </m.button>
  );
}
