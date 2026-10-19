import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import type { z } from "zod";
import { leadInputSchema, type LeadType } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ApiError, submitLead } from "@/lib/api";
import { useApi } from "@/lib/context";
import { categoriesQuery } from "@/lib/queries";
import { newKey } from "@/lib/utils";

type FormIn = z.input<typeof leadInputSchema>;
type FormOut = z.output<typeof leadInputSchema>;

const COPY: Record<LeadType, { submit: string; message: string; messageHint: string; success: string; showCompany: boolean; showCategory: boolean }> = {
  BUSINESS_REGISTRATION: {
    submit: "Register interest",
    message: "About your business",
    messageHint: "What you sell, where you operate and the distributors or markets you are looking for.",
    success: "Thanks. We received your business details. Profiles are reviewed before they are published, and publication depends on an active subscription.",
    showCompany: true,
    showCategory: true,
  },
  REQUIREMENT: {
    submit: "Send Your Requirement",
    message: "What are you looking for?",
    messageHint: "Product or category, territory, volumes and any investment range.",
    success: "Thanks. We received your requirement. We cannot guarantee a match or a reply from a distributor.",
    showCompany: true,
    showCategory: true,
  },
  CONTACT: { submit: "Send message", message: "Message", messageHint: "How can we help?", success: "Thanks. We received your message.", showCompany: false, showCategory: false },
};

export function LeadForm({ type }: { type: LeadType }) {
  const api = useApi();
  const { data: categories } = useQuery(categoriesQuery(api));
  const copy = COPY[type];
  const key = useRef(newKey());
  const [reference, setReference] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(leadInputSchema),
    mode: "onTouched",
    defaultValues: { type, name: "", companyName: "", email: "", phone: "", categorySlug: "", location: "", message: "", consent: false as unknown as true, idempotencyKey: key.current, website: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    try {
      setReference((await submitLead({ ...values, idempotencyKey: key.current })).reference);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) for (const [f, m] of Object.entries(err.fields)) setError(f as keyof FormIn, { message: m });
        setBanner(err.message);
      } else setBanner("Something went wrong. Please try again.");
    }
  });

  if (reference) {
    return (
      <div role="status" className="rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />
        <h2 className="mt-4 text-xl">Received</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{copy.success}</p>
        <p className="mt-4 text-sm">
          Reference <strong className="font-mono">{reference}</strong>
        </p>
        <Button asChild className="mt-6">
          <Link to="/distributors">Back to search</Link>
        </Button>
      </div>
    );
  }

  const flat = (categories ?? []).flatMap((c) => [c, ...c.children]);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card sm:p-7">
      <input type="hidden" {...register("type")} />
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" error={errors.name?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="name" aria-invalid={invalid} aria-describedby={describedBy} {...register("name")} />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} type="email" autoComplete="email" aria-invalid={invalid} aria-describedby={describedBy} {...register("email")} />}
        </Field>
        {copy.showCompany && (
          <Field label="Company name" optional={type === "REQUIREMENT"} error={errors.companyName?.message}>
            {({ id, describedBy, invalid }) => <Input id={id} autoComplete="organization" aria-invalid={invalid} aria-describedby={describedBy} {...register("companyName")} />}
          </Field>
        )}
        {/* Registrations need a number: the team calls every business before listing it (WhatsApp preferred). */}
        <Field label={type === "BUSINESS_REGISTRATION" ? "Phone (WhatsApp preferred)" : "Phone"} optional={type !== "BUSINESS_REGISTRATION"} error={errors.phone?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} type="tel" autoComplete="tel" aria-invalid={invalid} aria-describedby={describedBy} {...register("phone")} />}
        </Field>
        {copy.showCategory && (
          <Field label="Category" optional error={errors.categorySlug?.message}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} aria-invalid={invalid} aria-describedby={describedBy} {...register("categorySlug")}>
                <option value="">Select a category</option>
                {flat.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.parentId ? `— ${c.name}` : c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Location" optional error={errors.location?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-invalid={invalid} aria-describedby={describedBy} {...register("location")} />}
        </Field>
      </div>
      <Field label={copy.message} hint={copy.messageHint} error={errors.message?.message}>
        {({ id, describedBy, invalid }) => <Textarea id={id} rows={5} aria-invalid={invalid} aria-describedby={describedBy} {...register("message")} />}
      </Field>
      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded accent-[#3156D3]" aria-invalid={!!errors.consent} {...register("consent")} />
          <span>I agree that you may store these details and contact me about this request.</span>
        </label>
        {errors.consent && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
            {errors.consent.message}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {isSubmitting ? "Sending…" : copy.submit}
      </Button>
    </form>
  );
}
