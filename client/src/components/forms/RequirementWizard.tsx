import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { m } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { Link } from "react-router-dom";
import type { z } from "zod";
import { REQUIREMENT_KINDS, REQUIREMENT_KIND_LABELS, REQUIREMENT_STEP_FIELDS, requirementInputSchema, type RequirementKind } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ApiError, submitRequirement } from "@/lib/api";
import { useApi } from "@/lib/context";
import { categoriesQuery } from "@/lib/queries";
import { cn, newKey } from "@/lib/utils";

type FormIn = z.input<typeof requirementInputSchema>;
type FormOut = z.output<typeof requirementInputSchema>;

const STEPS = ["Your Information", "Requirement", "Distribution Details", "Review"] as const;
const KIND_HINT: Record<RequirementKind, string> = {
  DISTRIBUTOR: "A distributorship for a brand",
  PRODUCT: "A specific product",
  SUPPLIER: "A supplier or wholesaler",
  BRAND: "A brand to represent",
};

export function RequirementWizard() {
  const api = useApi();
  const { data: categories = [] } = useQuery(categoriesQuery(api));
  const key = useRef(newKey());
  const [step, setStep] = useState(0);
  const [reference, setReference] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    // The schema coerces budget strings to numbers; the resolver's generic cannot express input != output here.
    resolver: zodResolver(requirementInputSchema) as unknown as Resolver<FormIn, unknown, FormOut>,
    mode: "onTouched",
    defaultValues: {
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      companyName: "",
      contactLocation: "",
      kind: undefined,
      categorySlug: "",
      title: "",
      description: "",
      budgetMin: "",
      budgetMax: "",
      preferredLocation: "",
      experience: "",
      warehouse: "",
      distributionArea: "",
      additional: "",
      consent: false as unknown as true,
      idempotencyKey: key.current,
      website: "",
    },
  });

  const go = async (next: number) => {
    if (next > step) {
      const ok = await trigger([...REQUIREMENT_STEP_FIELDS[step]!] as never);
      if (!ok) return;
      if (step === 1) {
        // Cross-field rule: zod skips object-level refinements until every field is valid, so check it here too.
        const lo = Number(getValues("budgetMin"));
        const hi = Number(getValues("budgetMax"));
        if (getValues("budgetMin") !== "" && getValues("budgetMax") !== "" && hi < lo) {
          setError("budgetMax", { message: "Maximum budget must be at least the minimum" });
          return;
        }
      }
    }
    setBanner(null);
    setStep(next);
    requestAnimationFrame(() => document.getElementById("wizard-top")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const onSubmit = handleSubmit(
    async (values) => {
      setBanner(null);
      try {
        setReference((await submitRequirement({ ...values, idempotencyKey: key.current })).reference);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.fields) {
            const bad = Object.entries(err.fields);
            for (const [f, msg] of bad) setError(f as keyof FormIn, { message: msg });
            const first = REQUIREMENT_STEP_FIELDS.findIndex((fields) => bad.some(([f]) => (fields as readonly string[]).includes(f)));
            if (first >= 0) setStep(first);
          }
          setBanner(err.message);
        } else setBanner("Something went wrong. Please try again.");
      }
    },
    // The resolver covers every step; jump back to the first step that has an error.
    (errs) => {
      const first = REQUIREMENT_STEP_FIELDS.findIndex((fields) => (fields as readonly string[]).some((f) => f in errs));
      if (first >= 0) setStep(first);
    },
  );

  if (reference) {
    return (
      <div role="status" className="rounded-card border border-line bg-surface p-8 text-center shadow-card sm:p-12">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-success">
          <CheckCircle2 className="h-9 w-9" aria-hidden />
        </span>
        <h2 className="mt-5 text-2xl">Requirement submitted successfully.</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">Your requirement is now under review. Once approved it appears on the opportunities page, and interested businesses can send you enquiries.</p>
        <p className="mt-5 inline-block rounded-xl border border-line bg-slate-50 px-4 py-2.5 text-sm">
          <span className="text-muted">Reference </span>
          <strong className="font-mono tracking-wide text-ink">{reference}</strong>
        </p>
        <p className="mt-2 text-xs text-muted">Keep this reference. We do not guarantee approval or responses.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/leads">Browse opportunities</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/distributors">Find distributors</Link>
          </Button>
        </div>
      </div>
    );
  }

  const v = watch();
  const kind = v.kind as RequirementKind | undefined;
  const flat = categories.flatMap((c) => [c, ...c.children]);
  const catName = flat.find((c) => c.slug === v.categorySlug)?.name;

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
      <div id="wizard-top" className="scroll-mt-24" />
      <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className="min-w-0">
            <div className={cn("h-1.5 rounded-full transition-colors duration-300", i <= step ? "bg-primary" : "bg-slate-200")} />
            <p className={cn("mt-2 flex items-center gap-1.5 truncate text-xs font-medium sm:text-sm", i === step ? "text-ink" : "text-muted")}>
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]", i < step ? "bg-primary text-white" : i === step ? "bg-primary-soft text-primary-dark" : "bg-slate-100 text-slate-500")}>
                {i < step ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              <span className="hidden truncate sm:inline">{label}</span>
            </p>
          </li>
        ))}
      </ol>

      {/* Honeypot */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>
      <input type="hidden" {...register("idempotencyKey")} />

      {banner && (
        <div role="alert" className="mb-5 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{banner}</p>
        </div>
      )}

      <m.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h2 className="text-xl">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </h2>

        {step === 0 && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" error={errors.contactName?.message}>
              {({ id, describedBy, invalid }) => <Input id={id} autoComplete="name" aria-invalid={invalid} aria-describedby={describedBy} {...register("contactName")} />}
            </Field>
            <Field label="Phone Number" error={errors.contactPhone?.message}>
              {({ id, describedBy, invalid }) => <Input id={id} type="tel" autoComplete="tel" aria-invalid={invalid} aria-describedby={describedBy} {...register("contactPhone")} />}
            </Field>
            <Field label="Email Address" error={errors.contactEmail?.message} hint="Never shown publicly.">
              {({ id, describedBy, invalid }) => <Input id={id} type="email" autoComplete="email" aria-invalid={invalid} aria-describedby={describedBy} {...register("contactEmail")} />}
            </Field>
            <Field label="Company Name" optional error={errors.companyName?.message} hint="Shown on your opportunity if you add it.">
              {({ id, describedBy, invalid }) => <Input id={id} autoComplete="organization" aria-invalid={invalid} aria-describedby={describedBy} {...register("companyName")} />}
            </Field>
            <Field label="Location" className="sm:col-span-2" error={errors.contactLocation?.message} hint="Your city or country">
              {({ id, describedBy, invalid }) => <Input id={id} autoComplete="address-level2" aria-invalid={invalid} aria-describedby={describedBy} {...register("contactLocation")} />}
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="mt-5 space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">Looking for</legend>
              <div className="grid gap-3 sm:grid-cols-4">
                {REQUIREMENT_KINDS.map((k) => (
                  <label key={k} className={cn("cursor-pointer rounded-xl border p-3.5 transition-[border-color,background-color,box-shadow]", kind === k ? "border-primary bg-primary-soft/60 shadow-sm ring-2 ring-primary/20" : "border-line-strong bg-white hover:border-primary/40")}>
                    <input type="radio" value={k} className="sr-only" {...register("kind")} />
                    <span className="block text-sm font-semibold text-ink">{REQUIREMENT_KIND_LABELS[k]}</span>
                    <span className="mt-0.5 block text-xs text-muted">{KIND_HINT[k]}</span>
                  </label>
                ))}
              </div>
              {errors.kind && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                  {errors.kind.message}
                </p>
              )}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
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
              <Field label="Preferred Location" error={errors.preferredLocation?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} aria-invalid={invalid} aria-describedby={describedBy} {...register("preferredLocation")} />}
              </Field>
            </div>
            <Field label="Title" error={errors.title?.message} hint="A short headline, e.g. “Seeking snack brands for Pokhara”.">
              {({ id, describedBy, invalid }) => <Input id={id} aria-invalid={invalid} aria-describedby={describedBy} {...register("title")} />}
            </Field>
            <Field label="Requirement Description" error={errors.description?.message}>
              {({ id, describedBy, invalid }) => <Textarea id={id} rows={5} aria-invalid={invalid} aria-describedby={describedBy} {...register("description")} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Expected Budget (minimum)" optional error={errors.budgetMin?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} type="number" inputMode="numeric" min={0} aria-invalid={invalid} aria-describedby={describedBy} {...register("budgetMin")} />}
              </Field>
              <Field label="Expected Budget (maximum)" optional error={errors.budgetMax?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} type="number" inputMode="numeric" min={0} aria-invalid={invalid} aria-describedby={describedBy} {...register("budgetMax")} />}
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-5 space-y-4">
            <Field label="Experience" optional error={errors.experience?.message} hint="e.g. years in distribution or retail">
              {({ id, describedBy, invalid }) => <Input id={id} aria-invalid={invalid} aria-describedby={describedBy} {...register("experience")} />}
            </Field>
            <Field label="Warehouse / Storage" optional error={errors.warehouse?.message}>
              {({ id, describedBy, invalid }) => <Input id={id} aria-invalid={invalid} aria-describedby={describedBy} {...register("warehouse")} />}
            </Field>
            <Field label="Preferred Distribution Area" optional error={errors.distributionArea?.message}>
              {({ id, describedBy, invalid }) => <Input id={id} aria-invalid={invalid} aria-describedby={describedBy} {...register("distributionArea")} />}
            </Field>
            <Field label="Additional Requirements" optional error={errors.additional?.message}>
              {({ id, describedBy, invalid }) => <Textarea id={id} rows={4} aria-invalid={invalid} aria-describedby={describedBy} {...register("additional")} />}
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="mt-5">
            <dl className="divide-y divide-line rounded-xl border border-line text-sm">
              {(
                [
                  ["Name", v.contactName],
                  ["Phone", v.contactPhone],
                  ["Email", v.contactEmail],
                  ["Company", v.companyName || "—"],
                  ["Location", v.contactLocation],
                  ["Looking for", kind ? REQUIREMENT_KIND_LABELS[kind] : "—"],
                  ["Category", catName ?? "—"],
                  ["Title", v.title],
                  ["Description", v.description],
                  ["Budget", v.budgetMin || v.budgetMax ? `${v.budgetMin || "—"} – ${v.budgetMax || "—"}` : "—"],
                  ["Preferred location", v.preferredLocation],
                  ["Experience", v.experience || "—"],
                  ["Warehouse", v.warehouse || "—"],
                  ["Distribution area", v.distributionArea || "—"],
                ] as Array<[string, string]>
              ).map(([k, val]) => (
                <div key={k} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[180px_1fr]">
                  <dt className="text-muted">{k}</dt>
                  <dd className="whitespace-pre-line break-words font-medium text-ink">{val}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted">Your email and phone number are never published. Businesses respond through the platform and you decide whether to reply.</p>
            <div className="mt-5">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
                <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded accent-[#3156D3]" aria-invalid={!!errors.consent} {...register("consent")} />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" className="font-medium text-primary hover:underline" target="_blank">
                    Terms
                  </Link>{" "}
                  &amp;{" "}
                  <Link to="/privacy" className="font-medium text-primary hover:underline" target="_blank">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {errors.consent && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                  {errors.consent.message}
                </p>
              )}
            </div>
          </div>
        )}
      </m.div>

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
        <Button type="button" variant="secondary" size="lg" onClick={() => go(step - 1)} disabled={step === 0 || isSubmitting}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" size="lg" onClick={() => go(step + 1)}>
            Continue <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {isSubmitting ? "Submitting…" : "Submit Requirement"}
          </Button>
        )}
      </div>
    </form>
  );
}
