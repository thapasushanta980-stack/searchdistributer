import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, BadgeCheck, CheckCircle2, Factory, Loader2, PhoneCall, Store, Users } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { phoneRequiredLeadSchema, type leadInputSchema } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { OverlayDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ApiError, submitLead } from "@/lib/api";
import { cn, newKey } from "@/lib/utils";

type FormIn = z.input<typeof leadInputSchema>;
type FormOut = z.output<typeof leadInputSchema>;
export type QuickIntent = "FIND_DISTRIBUTORS" | "BECOME_DISTRIBUTOR";

const INTENTS: Record<QuickIntent, { tab: string; icon: typeof Factory; heading: string; points: string[]; message: string; placeholder: string; company: string; submit: string; done: string }> = {
  FIND_DISTRIBUTORS: {
    tab: "I need distributors",
    icon: Factory,
    heading: "Tell us what you make. We'll find who can sell it.",
    points: ["Our team calls you to understand your products and markets", "We share matching distributors and wholesalers", "Your request also reaches distributors searching the site"],
    message: "Your products and where you want to sell",
    placeholder: "e.g. Packaged spices, looking for distributors in Kathmandu valley and Pokhara",
    company: "Brand or company name",
    submit: "Find me distributors",
    done: "Our team will call you shortly to understand your products and suggest distributors.",
  },
  BECOME_DISTRIBUTOR: {
    tab: "I want a distributorship",
    icon: Store,
    heading: "Tell us what you'd like to distribute. We'll match you with brands.",
    points: ["Brands and manufacturers looking for partners in your area", "Help comparing investment, margins and support", "No cost to send your interest"],
    message: "What would you like to distribute?",
    placeholder: "e.g. FMCG or beverages in Butwal, investment up to NPR 10 lakh, 2,000 sq ft warehouse",
    company: "Your business name (optional)",
    submit: "Find me distributorships",
    done: "Our team will call you with brands looking for distributors in your area.",
  },
};

/** Two-intent quick requirement form (brand seeking distributors, or someone seeking a distributorship). */
export function QuickRequirementDialog({ open, onClose, onSubmitted, initialIntent = "FIND_DISTRIBUTORS" }: { open: boolean; onClose: () => void; onSubmitted: () => void; initialIntent?: QuickIntent }) {
  const [intent, setIntent] = useState<QuickIntent>(initialIntent);
  const key = useRef(newKey());
  const [reference, setReference] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const copy = INTENTS[intent];

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(phoneRequiredLeadSchema),
    mode: "onTouched",
    defaultValues: { type: initialIntent, name: "", companyName: "", email: "", phone: "", location: "", message: "", consent: false as unknown as true, idempotencyKey: key.current, website: "" },
  });

  const choose = (next: QuickIntent) => {
    setIntent(next);
    setValue("type", next);
  };

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    try {
      setReference((await submitLead({ ...values, type: intent, idempotencyKey: key.current })).reference);
      onSubmitted();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) for (const [f, m] of Object.entries(err.fields)) setError(f as keyof FormIn, { message: m });
        setBanner(err.message);
      } else setBanner("Something went wrong. Please try again.");
    }
  });

  return (
    <OverlayDialog open={open} onOpenChange={(o) => !o && onClose()} title="Tell us your requirement" hideTitle className="sm:max-w-3xl">
      <div className="grid overflow-y-auto sm:grid-cols-[1fr_minmax(0,260px)]">
        <div className="p-5 sm:p-7">
          {reference ? (
            <div role="status" className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />
              <h2 className="mt-4 text-xl">Thanks, we've got it</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{copy.done}</p>
              <p className="mt-4 text-sm">
                Reference <strong className="font-mono">{reference}</strong>
              </p>
              <Button className="mt-6" onClick={onClose}>
                Continue browsing
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-3.5">
              <div role="radiogroup" aria-label="What are you looking for?" className="grid grid-cols-2 gap-1 rounded-button bg-background p-1">
                {(Object.keys(INTENTS) as QuickIntent[]).map((k) => {
                  const Icon = INTENTS[k].icon;
                  const on = intent === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => choose(k)}
                      className={cn("flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] px-2 text-sm font-semibold transition-colors", on ? "bg-primary text-white shadow-sm" : "text-body hover:bg-white")}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden /> <span className="truncate">{INTENTS[k].tab}</span>
                    </button>
                  );
                })}
              </div>
              <h2 className="pt-1 text-lg leading-snug sm:hidden">{copy.heading}</h2>

              {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" {...register("website")} />
                </label>
              </div>
              {banner && (
                <div role="alert" className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>{banner}</p>
                </div>
              )}
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Your name" error={errors.name?.message}>
                  {({ id, describedBy, invalid }) => <Input id={id} autoComplete="name" aria-invalid={invalid} aria-describedby={describedBy} {...register("name")} />}
                </Field>
                <Field label="Phone (WhatsApp preferred)" error={errors.phone?.message}>
                  {({ id, describedBy, invalid }) => <Input id={id} type="tel" autoComplete="tel" placeholder="+977" aria-invalid={invalid} aria-describedby={describedBy} {...register("phone")} />}
                </Field>
                <Field label="Email" error={errors.email?.message}>
                  {({ id, describedBy, invalid }) => <Input id={id} type="email" autoComplete="email" aria-invalid={invalid} aria-describedby={describedBy} {...register("email")} />}
                </Field>
                <Field label="Location" optional error={errors.location?.message}>
                  {({ id, describedBy, invalid }) => <Input id={id} autoComplete="address-level2" placeholder="City" aria-invalid={invalid} aria-describedby={describedBy} {...register("location")} />}
                </Field>
              </div>
              <Field label={copy.company} optional={intent === "BECOME_DISTRIBUTOR"} error={errors.companyName?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} autoComplete="organization" aria-invalid={invalid} aria-describedby={describedBy} {...register("companyName")} />}
              </Field>
              <Field label={copy.message} error={errors.message?.message}>
                {({ id, describedBy, invalid }) => <Textarea id={id} rows={3} placeholder={copy.placeholder} aria-invalid={invalid} aria-describedby={describedBy} {...register("message")} />}
              </Field>
              <div>
                <label className="flex cursor-pointer items-start gap-3 text-xs text-slate-700">
                  <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded accent-[#3156D3]" aria-invalid={!!errors.consent} {...register("consent")} />
                  <span>
                    I agree that you may store these details and contact me about this request, under the{" "}
                    <a href="/terms" target="_blank" className="text-primary hover:underline">
                      terms
                    </a>
                    .
                  </span>
                </label>
                {errors.consent && (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                    {errors.consent.message}
                  </p>
                )}
              </div>
              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {isSubmitting ? "Sending…" : copy.submit}
              </Button>
            </form>
          )}
        </div>

        <aside className="hidden flex-col justify-center gap-5 bg-night p-7 text-white sm:flex">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/60">Free matchmaking</p>
          <h2 className="text-xl leading-snug text-white">{copy.heading}</h2>
          <ul className="space-y-3 text-sm text-white/80">
            {copy.points.map((p, i) => {
              const Icon = [PhoneCall, Users, BadgeCheck][i] ?? BadgeCheck;
              return (
                <li key={p} className="flex gap-2.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-white" aria-hidden />
                  {p}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </OverlayDialog>
  );
}
