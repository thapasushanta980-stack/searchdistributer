import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, MailCheck, Send } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { enquiryInputSchema, type EnquiryResponse } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { OverlayDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ApiError, resendEnquiryVerification, submitEnquiry } from "@/lib/api";
import { newKey } from "@/lib/utils";

type FormIn = z.input<typeof enquiryInputSchema>;
type FormOut = z.output<typeof enquiryInputSchema>;

export interface EnquiryTarget {
  slug: string;
  name: string;
}

export function EnquiryDialog({ target, onClose }: { target: EnquiryTarget | null; onClose: () => void }) {
  // Keep the last target while the exit animation plays.
  const last = useRef<EnquiryTarget | null>(null);
  if (target) last.current = target;
  const t = target ?? last.current;

  return (
    <OverlayDialog
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title="Connect with this distributor"
      description={t ? `Your enquiry will be sent to ${t.name}` : undefined}
    >
      {t && target && <EnquiryForm key={target.slug} target={t} onClose={onClose} />}
    </OverlayDialog>
  );
}

function EnquiryForm({ target, onClose }: { target: EnquiryTarget; onClose: () => void }) {
  const [result, setResult] = useState<EnquiryResponse | null>(null);
  const [banner, setBanner] = useState<{ tone: "error" | "warn"; text: string } | null>(null);
  const [resent, setResent] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  // One key per form instance: retries after a network error can never create a duplicate enquiry.
  const idempotencyKey = useRef(newKey());

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(enquiryInputSchema),
    mode: "onTouched",
    defaultValues: { distributorSlug: target.slug, name: "", email: "", phone: "", location: "", message: "", consent: false as unknown as true, idempotencyKey: idempotencyKey.current },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    try {
      setResult(await submitEnquiry({ ...values, idempotencyKey: idempotencyKey.current }));
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          for (const [field, message] of Object.entries(err.fields)) setError(field as keyof FormIn, { message });
        }
        if (err.code === "LISTING_UNAVAILABLE") setBanner({ tone: "warn", text: `${err.message} Your text is still here if you want to copy it.` });
        else if (err.code === "RATE_LIMITED") setBanner({ tone: "warn", text: err.message });
        else if (err.status === 0) setBanner({ tone: "error", text: `${err.message} Your details are saved in this form.` });
        else setBanner({ tone: "error", text: err.message });
      } else {
        setBanner({ tone: "error", text: "Something went wrong. Please try again." });
      }
    }
  });

  const resend = async () => {
    if (!result) return;
    setResent("sending");
    try {
      await resendEnquiryVerification({ reference: result.reference, email: getValues("email") });
      setResent("sent");
    } catch {
      setResent("failed");
    }
  };

  if (result) {
    const pending = result.requiresEmailVerification;
    const Icon = pending ? MailCheck : CheckCircle2;
    return (
      <div className="overflow-y-auto px-6 py-8 text-center" role="status" aria-live="polite">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-success">
          <Icon className="h-8 w-8" aria-hidden />
        </span>
        <h3 className="mt-4 text-xl">{pending ? "Check your email to finish" : "Enquiry sent successfully"}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          {pending
            ? `We sent a confirmation link to ${getValues("email")}. ${target.name} receives your enquiry once you confirm your email address. The link expires in 24 hours.`
            : "Your enquiry has been submitted. The business can now contact you using the information you provided."}
        </p>
        <div className="mx-auto mt-5 inline-block rounded-xl border border-line bg-slate-50 px-4 py-2.5 text-sm">
          <span className="text-muted">Reference number </span>
          <strong className="font-mono tracking-wide text-ink">{result.reference}</strong>
        </div>
        {pending && (
          <p className="mt-4 text-sm text-muted">
            Didn’t get it?{" "}
            <button type="button" onClick={resend} disabled={resent === "sending" || resent === "sent"} className="font-medium text-primary hover:underline disabled:text-muted disabled:no-underline">
              {resent === "sent" ? "Sent again — check your inbox" : resent === "sending" ? "Sending…" : "Send the confirmation again"}
            </button>
            {resent === "failed" && <span className="block text-danger">Could not resend right now. You can try again shortly.</span>}
          </p>
        )}
        <Button className="mt-6" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" {...register("distributorSlug")} />
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {banner && (
          <div role="alert" className={`flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${banner.tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{banner.text}</p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name?.message}>
            {({ id, describedBy, invalid }) => <Input id={id} autoComplete="name" aria-invalid={invalid} aria-describedby={describedBy} {...register("name")} />}
          </Field>
          <Field label="Email" error={errors.email?.message}>
            {({ id, describedBy, invalid }) => <Input id={id} type="email" autoComplete="email" inputMode="email" aria-invalid={invalid} aria-describedby={describedBy} {...register("email")} />}
          </Field>
          <Field label="Phone" optional error={errors.phone?.message}>
            {({ id, describedBy, invalid }) => <Input id={id} type="tel" autoComplete="tel" inputMode="tel" aria-invalid={invalid} aria-describedby={describedBy} {...register("phone")} />}
          </Field>
          <Field label="Location" error={errors.location?.message} hint="City or country">
            {({ id, describedBy, invalid }) => <Input id={id} autoComplete="address-level2" aria-invalid={invalid} aria-describedby={describedBy} {...register("location")} />}
          </Field>
        </div>
        <Field label="Message" error={errors.message?.message} hint="Tell them what you are looking for: products, territory, volumes.">
          {({ id, describedBy, invalid }) => <Textarea id={id} rows={5} aria-invalid={invalid} aria-describedby={describedBy} {...register("message")} />}
        </Field>
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded accent-[#3156D3]" aria-invalid={!!errors.consent} aria-describedby={errors.consent ? "consent-err" : undefined} {...register("consent")} />
            <span>I agree to share my contact information with this business.</span>
          </label>
          {errors.consent && (
            <p id="consent-err" role="alert" className="mt-1.5 text-xs font-medium text-danger">
              {errors.consent.message}
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-line bg-slate-50/70 px-5 py-4">
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          {isSubmitting ? "Sending…" : "Send Enquiry"}
        </Button>
        <p className="mt-2.5 text-center text-xs text-muted">An enquiry is not an order. The business decides whether and how to reply.</p>
      </div>
    </form>
  );
}
