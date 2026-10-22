import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { requirementResponseSchema } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { OverlayDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ApiError, respondToRequirement } from "@/lib/api";
import { newKey } from "@/lib/utils";

type FormIn = z.input<typeof requirementResponseSchema>;
type FormOut = z.output<typeof requirementResponseSchema>;

export interface ResponseTarget {
  slug: string;
  title: string;
}

export function RequirementResponseDialog({ target, onClose }: { target: ResponseTarget | null; onClose: () => void }) {
  const last = useRef<ResponseTarget | null>(null);
  if (target) last.current = target;
  const t = target ?? last.current;
  return (
    <OverlayDialog open={!!target} onOpenChange={(o) => !o && onClose()} title="Respond to this requirement" description={t ? `Requirement: ${t.title}` : undefined}>
      {t && target && <ResponseForm key={target.slug} target={t} onClose={onClose} />}
    </OverlayDialog>
  );
}

function ResponseForm({ target, onClose }: { target: ResponseTarget; onClose: () => void }) {
  const key = useRef(newKey());
  const [reference, setReference] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(requirementResponseSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", phone: "", location: "", message: "", consent: false as unknown as true, idempotencyKey: key.current },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    try {
      setReference((await respondToRequirement(target.slug, { ...values, idempotencyKey: key.current })).reference);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) for (const [f, m] of Object.entries(err.fields)) setError(f as keyof FormIn, { message: m });
        setBanner(err.message);
      } else setBanner("Something went wrong. Please try again.");
    }
  });

  if (reference) {
    return (
      <div className="overflow-y-auto px-6 py-8 text-center" role="status" aria-live="polite">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-success">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </span>
        <h3 className="mt-4 text-xl">Enquiry sent successfully</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">Your response has been sent to the person who posted this requirement. They can contact you using the details you provided.</p>
        <div className="mx-auto mt-5 inline-block rounded-xl border border-line bg-slate-50 px-4 py-2.5 text-sm">
          <span className="text-muted">Reference </span>
          <strong className="font-mono tracking-wide text-ink">{reference}</strong>
        </div>
        <div>
          <Button className="mt-6" onClick={onClose}>
            Continue Browsing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {banner && (
          <div role="alert" className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{banner}</p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name?.message}>
            {({ id, describedBy, invalid }) => <Input id={id} autoComplete="name" aria-invalid={invalid} aria-describedby={describedBy} {...register("name")} />}
          </Field>
          <Field label="Email" error={errors.email?.message}>
            {({ id, describedBy, invalid }) => <Input id={id} type="email" autoComplete="email" aria-invalid={invalid} aria-describedby={describedBy} {...register("email")} />}
          </Field>
          <Field label="Phone" optional error={errors.phone?.message}>
            {({ id, describedBy, invalid }) => <Input id={id} type="tel" autoComplete="tel" aria-invalid={invalid} aria-describedby={describedBy} {...register("phone")} />}
          </Field>
          <Field label="Location" error={errors.location?.message}>
            {({ id, describedBy, invalid }) => <Input id={id} autoComplete="address-level2" aria-invalid={invalid} aria-describedby={describedBy} {...register("location")} />}
          </Field>
        </div>
        <Field label="Message" error={errors.message?.message} hint="Introduce your business and what you can offer.">
          {({ id, describedBy, invalid }) => <Textarea id={id} rows={5} aria-invalid={invalid} aria-describedby={describedBy} {...register("message")} />}
        </Field>
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded accent-[#3156D3]" aria-invalid={!!errors.consent} {...register("consent")} />
            <span>I agree to share my contact information with this business.</span>
          </label>
          {errors.consent && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
              {errors.consent.message}
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-line bg-slate-50/70 px-5 py-4">
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {isSubmitting ? "Sending…" : "Send Response"}
          </Button>
        </div>
      </div>
    </form>
  );
}
