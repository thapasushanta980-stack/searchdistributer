import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Archive, ArrowLeft, Check, CircleSlash, ExternalLink, Inbox, Pause, Pencil, Plus, Rocket } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  COVERAGE_LABELS,
  COVERAGE_SCOPES,
  LISTING_STATUS_LABELS,
  NEPAL_CITIES,
  VERIFICATION_LABELS,
  VERIFICATION_STATUSES,
  adminListingInputSchema,
  type AdminLeadDTO,
  type AdminListingAction,
  type AdminListingDTO,
  type AdminListingInput,
  type AdminProductDTO,
  type AdminProductInput,
  type CategoryDTO,
} from "@sd/shared";
import { CityPicker } from "@/components/forms/CityPicker";
import { ImageGalleryUpload, ImageUpload } from "./ImageUpload";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminApiError, adminApi } from "./api";
import { LISTINGS_KEY } from "./ListingsPage";
import {
  Card,
  DeleteButton,
  ErrorLine,
  Field,
  PageHeader,
  Select,
  StatusBadge,
  TagInput,
  TextArea,
  TextInput,
  Toggle,
  fieldError,
  fmtDate,
  fromDateInput,
  toDateInput,
  useAdminMutation,
  useIsSuperAdmin,
} from "./ui";

/* ------------------------------------------------------------------ */
/* Form model                                                          */
/* ------------------------------------------------------------------ */

/** Form state keeps raw strings so half-typed values (like "19") never fight the input. */
interface FormState {
  name: string;
  businessType: AdminListingInput["businessType"];
  categoryId: string;
  summary: string;
  description: string;
  location: string;
  city: string;
  country: string;
  coverage: AdminListingInput["coverage"];
  territories: string[];
  specialties: string[];
  website: string;
  logoUrl: string;
  coverImageUrl: string;
  galleryImageUrls: string[];
  contactPerson: string;
  whatsappNumber: string;
  notificationEmail: string;
  foundedYear: string;
  distributorshipInfo: string;
  minimumOrder: string;
  supportOffered: string;
  investmentMin: string;
  investmentMax: string;
  investmentCurrency: string;
  verificationStatus: AdminListingInput["verificationStatus"];
  isFeatured: boolean;
  featuredUntil: string;
  listedUntil: string;
}

const blank: FormState = {
  name: "",
  businessType: "DISTRIBUTOR",
  categoryId: "",
  summary: "",
  description: "",
  location: "",
  city: "Kathmandu",
  country: "Nepal",
  coverage: "NATIONAL",
  territories: [],
  specialties: [],
  website: "",
  logoUrl: "",
  coverImageUrl: "",
  galleryImageUrls: [],
  contactPerson: "",
  whatsappNumber: "",
  notificationEmail: "",
  foundedYear: "",
  distributorshipInfo: "",
  minimumOrder: "",
  supportOffered: "",
  investmentMin: "",
  investmentMax: "",
  investmentCurrency: "NPR",
  verificationStatus: "NONE",
  isFeatured: false,
  featuredUntil: "",
  listedUntil: "",
};

const fromListing = (l: AdminListingDTO): FormState => ({
  name: l.name,
  businessType: l.businessType,
  categoryId: l.categoryId ?? "",
  summary: l.summary,
  description: l.description,
  location: l.location,
  city: l.city ?? "",
  country: l.country ?? "",
  coverage: l.coverage,
  territories: l.territories,
  specialties: l.specialties,
  website: l.website ?? "",
  logoUrl: l.logoUrl ?? "",
  coverImageUrl: l.coverImageUrl ?? "",
  galleryImageUrls: l.galleryImageUrls ?? [],
  contactPerson: l.contactPerson ?? "",
  whatsappNumber: l.whatsappNumber ?? "",
  notificationEmail: l.notificationEmail ?? "",
  foundedYear: l.foundedYear ? String(l.foundedYear) : "",
  distributorshipInfo: l.distributorshipInfo ?? "",
  minimumOrder: l.minimumOrder ?? "",
  supportOffered: l.supportOffered ?? "",
  investmentMin: l.investmentMin !== null ? String(l.investmentMin) : "",
  investmentMax: l.investmentMax !== null ? String(l.investmentMax) : "",
  investmentCurrency: l.investmentCurrency ?? "NPR",
  verificationStatus: l.verificationStatus,
  isFeatured: l.isFeatured,
  featuredUntil: toDateInput(l.featuredUntil),
  listedUntil: toDateInput(l.listedUntil),
});

/** Prefill from a registration or "find distributors" lead. */
const fromLead = (lead: AdminLeadDTO, categories: CategoryDTO[]): FormState => {
  const cat = categories.flatMap((c) => [c, ...c.children]).find((c) => c.slug === lead.categorySlug);
  const city = lead.location ?? "";
  return {
    ...blank,
    name: lead.companyName ?? lead.name,
    businessType: lead.registrationSide === "BRAND" || lead.type === "FIND_DISTRIBUTORS" ? "MANUFACTURER" : blank.businessType,
    contactPerson: lead.name,
    whatsappNumber: lead.phone ?? "",
    notificationEmail: lead.email ?? "",
    city: city || "Kathmandu",
    location: city ? `${city}, Nepal` : "",
    categoryId: cat?.id ?? "",
    description: lead.message,
  };
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));

const toInput = (f: FormState, fromLeadId?: string): AdminListingInput => ({
  name: f.name,
  businessType: f.businessType,
  categoryId: f.categoryId || null,
  summary: f.summary,
  description: f.description,
  location: f.location,
  city: f.city,
  country: f.country || null,
  coverage: f.coverage,
  territories: f.territories,
  specialties: f.specialties,
  website: f.website || null,
  logoUrl: f.logoUrl || null,
  coverImageUrl: f.coverImageUrl || null,
  galleryImageUrls: f.galleryImageUrls,
  contactPerson: f.contactPerson || null,
  whatsappNumber: f.whatsappNumber || null,
  notificationEmail: f.notificationEmail || null,
  foundedYear: num(f.foundedYear),
  distributorshipInfo: f.distributorshipInfo || null,
  minimumOrder: f.minimumOrder || null,
  supportOffered: f.supportOffered || null,
  investmentMin: num(f.investmentMin),
  investmentMax: num(f.investmentMax),
  investmentCurrency: f.investmentMin || f.investmentMax ? f.investmentCurrency || null : null,
  verificationStatus: f.verificationStatus,
  isFeatured: f.isFeatured,
  featuredUntil: f.isFeatured ? fromDateInput(f.featuredUntil) : null,
  listedUntil: fromDateInput(f.listedUntil),
  ...(fromLeadId ? { fromLeadId } : {}),
});

/* ------------------------------------------------------------------ */
/* Tabs and field metadata                                             */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: "essentials", label: "Essentials", hint: "Everything required to save" },
  { key: "profile", label: "Profile", hint: "Brand, contact and coverage" },
  { key: "terms", label: "Distribution terms", hint: "What distributors get" },
  { key: "publishing", label: "Publishing", hint: "Listing period and trust" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/** Where each field lives and what it's called, for tab error badges and the error summary. */
const FIELDS: Record<string, { tab: Tab; label: string }> = {
  name: { tab: "essentials", label: "Company name" },
  businessType: { tab: "essentials", label: "Business type" },
  categoryId: { tab: "essentials", label: "Category" },
  city: { tab: "essentials", label: "City" },
  location: { tab: "essentials", label: "Shown on cards as" },
  summary: { tab: "essentials", label: "Summary" },
  description: { tab: "essentials", label: "Description" },
  whatsappNumber: { tab: "essentials", label: "WhatsApp number" },
  logoUrl: { tab: "profile", label: "Brand logo" },
  coverImageUrl: { tab: "profile", label: "Cover image" },
  galleryImageUrls: { tab: "profile", label: "Brand gallery" },
  website: { tab: "profile", label: "Website" },
  contactPerson: { tab: "profile", label: "Contact person" },
  notificationEmail: { tab: "profile", label: "Notification email" },
  country: { tab: "profile", label: "Country" },
  coverage: { tab: "profile", label: "Coverage" },
  territories: { tab: "profile", label: "Territories served" },
  specialties: { tab: "profile", label: "Specialties" },
  foundedYear: { tab: "profile", label: "Founded" },
  minimumOrder: { tab: "terms", label: "Minimum order" },
  supportOffered: { tab: "terms", label: "Support offered" },
  distributorshipInfo: { tab: "terms", label: "Distributorship terms" },
  investmentMin: { tab: "terms", label: "Investment from" },
  investmentMax: { tab: "terms", label: "Investment up to" },
  investmentCurrency: { tab: "terms", label: "Currency" },
  verificationStatus: { tab: "publishing", label: "Verification" },
  listedUntil: { tab: "publishing", label: "Listed until" },
  isFeatured: { tab: "publishing", label: "Featured" },
  featuredUntil: { tab: "publishing", label: "Featured until" },
};

/** Same rules as the server, run in the browser so errors appear instantly. */
function validate(f: FormState): Record<string, string> {
  const r = adminListingInputSchema.safeParse(toInput(f));
  const out: Record<string, string> = {};
  if (!r.success) for (const i of r.error.issues) out[String(i.path[0] ?? "_")] ??= i.message;
  return out;
}

/** Profile completeness: what makes a listing convincing to a distributor, weighted. */
function completeness(f: FormState, productCount: number) {
  const checks: Array<{ ok: boolean; weight: number; label: string; tab: Tab }> = [
    { ok: f.description.trim().length >= 150, weight: 15, label: "A description of at least 150 characters", tab: "essentials" },
    { ok: !!f.whatsappNumber.trim(), weight: 15, label: "A WhatsApp number", tab: "essentials" },
    { ok: productCount > 0, weight: 15, label: "At least one product", tab: "essentials" },
    { ok: !!f.logoUrl.trim(), weight: 10, label: "A logo", tab: "profile" },
    { ok: f.specialties.length > 0, weight: 10, label: "Specialties", tab: "profile" },
    { ok: f.territories.length > 0, weight: 10, label: "Territories served", tab: "profile" },
    { ok: !!f.website.trim(), weight: 5, label: "A website", tab: "profile" },
    { ok: !!f.foundedYear.trim(), weight: 5, label: "Year founded", tab: "profile" },
    { ok: !!(f.minimumOrder.trim() || f.distributorshipInfo.trim()), weight: 10, label: "Minimum order or terms", tab: "terms" },
    { ok: !!(f.investmentMin || f.investmentMax), weight: 5, label: "An investment range", tab: "terms" },
  ];
  const score = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  return { score, missing: checks.filter((c) => !c.ok).sort((a, b) => b.weight - a.weight) };
}

/** NPR amounts read naturally in lakhs and crores. */
function amountHint(v: string, currency: string) {
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n <= 0) return undefined;
  if (currency !== "NPR") return `${currency} ${n.toLocaleString()}`;
  if (n >= 10_000_000) return `NPR ${(n / 10_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} crore`;
  if (n >= 100_000) return `NPR ${(n / 100_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} lakh`;
  return `NPR ${n.toLocaleString()}`;
}

function CategorySelect({ id, value, onChange, categories, invalid }: { id: string; value: string; onChange: (v: string) => void; categories: CategoryDTO[]; invalid?: boolean }) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid}>
      <option value="">No category</option>
      {categories.map((c) => (
        <optgroup key={c.id} label={c.name}>
          <option value={c.id}>{c.name} (all)</option>
          {c.children.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

/** A field wrapper that tags its control with data-field (for jump-to-error). Defined at module level so
 * inputs keep focus while typing. */
function F({ field, label, hint, error, className, children }: { field: string; label?: string; hint?: string; error?: string; className?: string; children: (id: string) => ReactNode }) {
  return (
    <div data-field={field} className={className}>
      <Field label={label ?? FIELDS[field]?.label ?? field} hint={hint} error={error}>
        {children}
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ListingEditPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const [params] = useSearchParams();
  const leadId = isNew ? (params.get("fromLead") ?? undefined) : undefined;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const categories = useQuery({ queryKey: ["admin", "categories"], queryFn: adminApi.categories, staleTime: 5 * 60_000 });
  const listing = useQuery({ queryKey: [...LISTINGS_KEY, "one", id], queryFn: () => adminApi.listing(id!), enabled: !isNew });
  const lead = useQuery({ queryKey: ["admin", "leads", "one", leadId], queryFn: () => adminApi.lead(leadId!), enabled: !!leadId });

  const [form, setForm] = useState<FormState>(blank);
  const [baseline, setBaseline] = useState<FormState>(blank);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("essentials");
  const [attempted, setAttempted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNew && listing.data && loadedFor !== listing.data.updatedAt) {
      const f = fromListing(listing.data);
      setForm(f);
      setBaseline(f);
      setLoadedFor(listing.data.updatedAt);
    }
    if (isNew && lead.data && categories.data && loadedFor !== lead.data.id) {
      setForm(fromLead(lead.data, categories.data));
      setLoadedFor(lead.data.id);
    }
  }, [isNew, listing.data, lead.data, categories.data, loadedFor]);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  // Warn before closing the tab or reloading with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setCity = (city: string) =>
    setForm((f) => {
      // Keep "shown on cards as" in step with the city unless someone wrote their own.
      const auto = !f.location || f.location === `${f.city}, Nepal` || f.location === f.city;
      return { ...f, city, location: auto ? (city ? `${city}, Nepal` : "") : f.location, country: f.country || "Nepal" };
    });

  const save = useAdminMutation(
    (input: AdminListingInput) => (isNew ? adminApi.createListing(input) : adminApi.updateListing(id!, input)),
    [LISTINGS_KEY, ["admin", "leads"]],
    (saved) => {
      qc.setQueryData([...LISTINGS_KEY, "one", saved.id], saved);
      const f = fromListing(saved);
      setBaseline(f);
      if (isNew) navigate(`/listings/${saved.id}`, { replace: true });
    },
  );

  const clientErrors = useMemo(() => validate(form), [form]);
  const serverFields = save.error instanceof AdminApiError ? (save.error.fields ?? {}) : {};
  const errors: Record<string, string> = attempted ? { ...serverFields, ...clientErrors } : serverFields;
  const err = (field: string) => errors[field] ?? fieldError(save.error, field);
  const errorCount = (t: Tab) => Object.keys(errors).filter((k) => FIELDS[k]?.tab === t).length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    const found = validate(form);
    if (Object.keys(found).length) {
      const first = Object.keys(found).find((k) => FIELDS[k]);
      if (first) setTab(FIELDS[first]!.tab);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    save.mutate(toInput(form, leadId));
  };

  const jumpTo = (field: string) => {
    const meta = FIELDS[field];
    if (meta) setTab(meta.tab);
    requestAnimationFrame(() => (document.querySelector(`[data-field="${field}"] input, [data-field="${field}"] textarea, [data-field="${field}"] select`) as HTMLElement | null)?.focus());
  };

  const leave = (e: React.MouseEvent) => {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) e.preventDefault();
  };

  if (!isNew && listing.isLoading) return <div className="skeleton h-96 w-full rounded-card" aria-busy="true" />;
  if (!isNew && listing.isError) return <ErrorLine error={listing.error} />;

  const cats = categories.data ?? [];
  const l = listing.data;
  const productCount = l?.products.length ?? 0;
  const complete = completeness(form, productCount);
  const errorList = Object.entries(errors).filter(([k]) => FIELDS[k]);


  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/listings" onClick={leave} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Listings
      </Link>
      <PageHeader
        title={isNew ? "New listing" : (l?.name ?? "Listing")}
        description={isNew ? (lead.data ? `Prefilled from lead ${lead.data.reference}. Check every field before saving.` : "Saved as a draft. Publish it once it's ready.") : undefined}
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <form onSubmit={submit} noValidate>
            {errorList.length > 0 && (
              <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-4 rounded-card border border-danger/30 bg-danger/5 p-4 text-sm outline-none">
                <p className="flex items-center gap-2 font-semibold text-danger">
                  <AlertTriangle className="h-4 w-4" aria-hidden /> {errorList.length === 1 ? "1 field needs attention" : `${errorList.length} fields need attention`}
                </p>
                <ul className="mt-2 space-y-1">
                  {errorList.map(([k, msg]) => (
                    <li key={k}>
                      <button type="button" onClick={() => jumpTo(k)} className="text-left text-danger underline-offset-2 hover:underline">
                        <strong className="font-medium">{FIELDS[k]!.label}</strong> ({TABS.find((t) => t.key === FIELDS[k]!.tab)!.label}): {msg}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div role="tablist" aria-label="Listing sections" className="scrollbar-none flex gap-1 overflow-x-auto border-b border-line">
              {TABS.map((t) => {
                const n = errorCount(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    id={`tab-${t.key}`}
                    aria-selected={tab === t.key}
                    aria-controls={`panel-${t.key}`}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "-mb-px flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors",
                      tab === t.key ? "border-primary text-primary-dark" : "border-transparent text-body hover:text-ink",
                    )}
                  >
                    {t.label}
                    {n > 0 && <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold text-white" aria-label={`${n} errors`}>{n}</span>}
                  </button>
                );
              })}
            </div>

            <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="rounded-b-card border border-t-0 border-line bg-surface p-4 shadow-card sm:p-6">
              <p className="mb-5 text-sm text-muted">{TABS.find((t) => t.key === tab)!.hint}</p>

              {tab === "essentials" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <F field="name" error={err("name")} className="sm:col-span-2">
                    {(fid) => <TextInput id={fid} value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />}
                  </F>
                  <F field="businessType" error={err("businessType")} hint={form.businessType === "MANUFACTURER" ? "Manufacturers appear under Brands." : undefined}>
                    {(fid) => (
                      <Select id={fid} value={form.businessType} onChange={(e) => set("businessType", e.target.value as FormState["businessType"])}>
                        {BUSINESS_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {BUSINESS_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </F>
                  <F field="categoryId" error={err("categoryId")}>{(fid) => <CategorySelect id={fid} value={form.categoryId} onChange={(v) => set("categoryId", v)} categories={cats} invalid={!!err("categoryId")} />}</F>
                  <F field="city" error={err("city")}>{(fid) => <CityPicker id={fid} value={form.city} onChange={setCity} />}</F>
                  <F field="location" error={err("location")} hint='Shown on search cards, e.g. "Pokhara, Nepal".'>
                    {(fid) => <TextInput id={fid} value={form.location} onChange={(e) => set("location", e.target.value)} maxLength={120} />}
                  </F>
                  <F field="summary" error={err("summary")} hint={`One or two sentences for search cards. ${form.summary.trim().length}/300`} className="sm:col-span-2">
                    {(fid) => <TextArea id={fid} rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} maxLength={300} />}
                  </F>
                  <F field="description" error={err("description")} hint={`The full profile. ${form.description.trim().length} characters; 150+ reads well.`} className="sm:col-span-2">
                    {(fid) => <TextArea id={fid} rows={6} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} />}
                  </F>
                  <F field="whatsappNumber" error={err("whatsappNumber")} hint="With country code. Visitors reach it through a tracked button; the number is never printed.">
                    {(fid) => <TextInput id={fid} type="tel" value={form.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} maxLength={24} placeholder="+977 98XXXXXXXX" />}
                  </F>
                </div>
              )}

              {tab === "profile" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><ImageUpload label="Brand logo" kind="logo" value={form.logoUrl} onChange={(v) => set("logoUrl", v)} alt={`${form.name || "Business"} logo`} aspect="aspect-square" error={err("logoUrl")} /></div>
                  <div className="sm:col-span-2"><ImageUpload label="Cover image" kind="cover" value={form.coverImageUrl} onChange={(v) => set("coverImageUrl", v)} alt={`${form.name || "Business"} cover`} /></div>
                  <div className="sm:col-span-2"><ImageGalleryUpload label="Brand photos" kind="gallery" value={form.galleryImageUrls} onChange={(v) => set("galleryImageUrls", v)} max={12} /></div>
                  <F field="website" error={err("website")}>{(fid) => <TextInput id={fid} type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />}</F>
                  <F field="contactPerson" error={err("contactPerson")}>{(fid) => <TextInput id={fid} value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} maxLength={120} />}</F>
                  <F field="notificationEmail" error={err("notificationEmail")} hint="Enquiries are emailed here. Never shown publicly.">
                    {(fid) => <TextInput id={fid} type="email" value={form.notificationEmail} onChange={(e) => set("notificationEmail", e.target.value)} maxLength={200} />}
                  </F>
                  <F field="coverage" error={err("coverage")}>
                    {(fid) => (
                      <Select id={fid} value={form.coverage} onChange={(e) => set("coverage", e.target.value as FormState["coverage"])}>
                        {COVERAGE_SCOPES.map((c) => (
                          <option key={c} value={c}>
                            {COVERAGE_LABELS[c]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </F>
                  <F field="country" error={err("country")}>{(fid) => <TextInput id={fid} value={form.country} onChange={(e) => set("country", e.target.value)} maxLength={80} />}</F>
                  <F field="territories" error={err("territories")} hint="Press Enter after each place." className="sm:col-span-2">
                    {(fid) => <TagInput id={fid} value={form.territories} onChange={(v) => set("territories", v)} max={50} placeholder={`e.g. ${NEPAL_CITIES.slice(0, 3).join(", ")}`} />}
                  </F>
                  <F field="specialties" error={err("specialties")} hint="What they're known for. Press Enter after each." className="sm:col-span-2">
                    {(fid) => <TagInput id={fid} value={form.specialties} onChange={(v) => set("specialties", v)} placeholder="e.g. Cold chain, Retail coverage" />}
                  </F>
                  <F field="foundedYear" error={err("foundedYear")}>
                    {(fid) => <TextInput id={fid} inputMode="numeric" value={form.foundedYear} onChange={(e) => set("foundedYear", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="e.g. 2012" />}
                  </F>
                </div>
              )}

              {tab === "terms" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <F field="minimumOrder" error={err("minimumOrder")} hint="e.g. 50 cartons or NPR 1 lakh per order">
                    {(fid) => <TextInput id={fid} value={form.minimumOrder} onChange={(e) => set("minimumOrder", e.target.value)} maxLength={300} />}
                  </F>
                  <F field="supportOffered" error={err("supportOffered")} hint="e.g. Marketing material, training, credit">
                    {(fid) => <TextInput id={fid} value={form.supportOffered} onChange={(e) => set("supportOffered", e.target.value)} maxLength={1000} />}
                  </F>
                  <F field="distributorshipInfo" error={err("distributorshipInfo")} hint="Margins, exclusivity, payment terms." className="sm:col-span-2">
                    {(fid) => <TextArea id={fid} rows={4} value={form.distributorshipInfo} onChange={(e) => set("distributorshipInfo", e.target.value)} maxLength={2000} />}
                  </F>
                  <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[1fr_1fr_120px]">
                    <F field="investmentMin" error={err("investmentMin")} hint={amountHint(form.investmentMin, form.investmentCurrency)}>
                      {(fid) => <TextInput id={fid} inputMode="numeric" value={form.investmentMin} onChange={(e) => set("investmentMin", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 500000" />}
                    </F>
                    <F field="investmentMax" error={err("investmentMax")} hint={amountHint(form.investmentMax, form.investmentCurrency)}>
                      {(fid) => <TextInput id={fid} inputMode="numeric" value={form.investmentMax} onChange={(e) => set("investmentMax", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 2000000" />}
                    </F>
                    <F field="investmentCurrency" error={err("investmentCurrency")} label="Currency">
                      {(fid) => (
                        <Select id={fid} value={form.investmentCurrency} onChange={(e) => set("investmentCurrency", e.target.value)}>
                          {["NPR", "INR", "USD"].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </Select>
                      )}
                    </F>
                  </div>
                </div>
              )}

              {tab === "publishing" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <F field="listedUntil" error={err("listedUntil")} hint="End of the paid listing period. Required to publish; the listing hides itself after this date.">
                    {(fid) => <TextInput id={fid} type="date" value={form.listedUntil} onChange={(e) => set("listedUntil", e.target.value)} />}
                  </F>
                  <F field="verificationStatus" error={err("verificationStatus")} hint="Only claim what you have actually checked.">
                    {(fid) => (
                      <Select id={fid} value={form.verificationStatus} onChange={(e) => set("verificationStatus", e.target.value as FormState["verificationStatus"])}>
                        {VERIFICATION_STATUSES.map((v) => (
                          <option key={v} value={v}>
                            {VERIFICATION_LABELS[v]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </F>
                  <div className="sm:col-span-2">
                    <Toggle label="Featured" hint="Shown in the featured strip on search pages." checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} />
                  </div>
                  {form.isFeatured && (
                    <F field="featuredUntil" error={err("featuredUntil")} hint="Leave empty to feature with no end date.">
                      {(fid) => <TextInput id={fid} type="date" value={form.featuredUntil} onChange={(e) => set("featuredUntil", e.target.value)} />}
                    </F>
                  )}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-sm">
                {TABS.findIndex((t) => t.key === tab) > 0 ? (
                  <button type="button" className="text-muted hover:text-ink" onClick={() => setTab(TABS[TABS.findIndex((t) => t.key === tab) - 1]!.key)}>
                    ← {TABS[TABS.findIndex((t) => t.key === tab) - 1]!.label}
                  </button>
                ) : (
                  <span />
                )}
                {TABS.findIndex((t) => t.key === tab) < TABS.length - 1 && (
                  <button type="button" className="font-medium text-primary hover:text-primary-dark" onClick={() => setTab(TABS[TABS.findIndex((t) => t.key === tab) + 1]!.key)}>
                    {TABS[TABS.findIndex((t) => t.key === tab) + 1]!.label} →
                  </button>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex flex-wrap items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
              <Button type="submit" disabled={save.isPending}>
                <Check className="h-4 w-4" aria-hidden /> {save.isPending ? "Saving…" : isNew ? "Create draft" : "Save changes"}
              </Button>
              {dirty ? <span className="text-sm text-muted">Unsaved changes</span> : save.isSuccess ? <span className="text-sm text-success">All changes saved.</span> : null}
              {save.error && !Object.keys(serverFields).length && <ErrorLine error={save.error} />}
            </div>
          </form>

          {l && <ProductsSection listing={l} categories={cats} />}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {l ? <StatusPanel listing={l} /> : <Card className="text-sm text-muted">Create the draft first. Publishing, products and enquiries appear here once it's saved.</Card>}
          <Card>
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-ink">Profile strength</h2>
              <span className="text-sm font-semibold tabular-nums text-ink">{complete.score}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-primary-soft" role="meter" aria-valuenow={complete.score} aria-valuemin={0} aria-valuemax={100} aria-label="Profile strength">
              <div className="h-2 rounded-full bg-primary transition-[width]" style={{ width: `${complete.score}%` }} />
            </div>
            {complete.missing.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {complete.missing.slice(0, 4).map((m) => (
                  <li key={m.label}>
                    <button type="button" onClick={() => setTab(m.tab)} className="text-left text-body hover:text-primary">
                      + {m.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="overflow-hidden p-0 sm:p-0">
            <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Visitor view</p>
                <h2 className="mt-1 text-sm font-semibold text-ink">Profile preview</h2>
              </div>
              <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-muted">Live</span>
            </div>
            <div className="m-4 overflow-hidden rounded-xl border border-line bg-white shadow-sm sm:m-5">
              <div className="relative h-20 overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-800">
                {form.coverImageUrl && <img src={form.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 to-transparent" />
              </div>
              <div className="px-3 pb-3">
                <div className="-mt-6 flex items-end justify-between gap-2">
                  <div className="rounded-xl border-2 border-white bg-white shadow-sm">
                    {form.logoUrl ? <img src={form.logoUrl} alt="" className="h-12 w-12 rounded-[10px] object-contain p-1" /> : <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-primary-soft text-sm font-bold text-primary-dark">{(form.name || "BN").trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</div>}
                  </div>
                  <span className="mb-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{BUSINESS_TYPE_LABELS[form.businessType]}</span>
                </div>
                <p className="mt-2 truncate text-[11px] font-semibold uppercase tracking-wide text-primary">{cats.flatMap((c) => [c, ...c.children]).find((c) => c.id === form.categoryId)?.name ?? "Business category"}</p>
                <p className="mt-0.5 truncate text-base font-bold text-slate-950">{form.name || "Your business name"}</p>
                <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-relaxed text-muted">{form.summary || "A short introduction helps distributors understand your business."}</p>
                <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                  <span className="truncate">{form.city || "City"}, {form.country || "Nepal"}</span><span aria-hidden>·</span><span className="truncate">{COVERAGE_LABELS[form.coverage]}</span>
                </div>
                {form.specialties.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{form.specialties.slice(0, 2).map((tag) => <span key={tag} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{tag}</span>)}</div>}
              </div>
            </div>
            <div className="border-t border-line bg-slate-50/70 px-4 py-3 sm:px-5">
              {l?.visibility.isPublic ? <a href={`/distributors/${l.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark"><ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open public profile</a> : <p className="text-xs leading-relaxed text-muted">This preview updates as you edit. Publish the listing to make it visible to visitors.</p>}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status and actions                                                  */
/* ------------------------------------------------------------------ */

function Check2({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={cn("flex items-start gap-2 text-sm", ok ? "text-ink" : "text-muted")}>
      {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> : <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />}
      {label}
    </li>
  );
}

function StatusPanel({ listing: l }: { listing: AdminListingDTO }) {
  const superAdmin = useIsSuperAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const act = useAdminMutation((a: AdminListingAction) => adminApi.listingAction(l.id, a), [LISTINGS_KEY], (saved) => qc.setQueryData([...LISTINGS_KEY, "one", saved.id], saved));
  const remove = useAdminMutation(() => adminApi.deleteListing(l.id), [LISTINGS_KEY], () => navigate("/listings", { replace: true }));
  const v = l.visibility;
  const periodOk = v.subscriptionActive;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={l.status} label={LISTING_STATUS_LABELS[l.status]} />
        {v.isPublic ? <StatusBadge status="LIVE" label="Visible on site" /> : <StatusBadge status="HIDDEN" label="Hidden from site" />}
      </div>
      <p className="mt-2 break-all text-xs text-muted">
        /distributors/{l.slug} · {l.enquiryCount} enquiries · created {fmtDate(l.createdAt)}
      </p>
      <ul className="mt-3 space-y-1.5">
        <Check2 ok={v.approved && v.published} label="Published" />
        <Check2 ok={periodOk} label={periodOk ? `Listing period current (until ${fmtDate(l.listedUntil)})` : "Listing period current: set 'Listed until' (Publishing tab) and save"} />
        <Check2 ok={v.profileApproved && v.organisationActive} label="Business profile approved" />
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!(v.approved && v.published) && (
          <Button size="sm" onClick={() => act.mutate({ action: "PUBLISH" })} disabled={act.isPending || !periodOk} title={periodOk ? undefined : "Set a future 'Listed until' date and save first"}>
            <Rocket className="h-4 w-4" aria-hidden /> Publish
          </Button>
        )}
        {l.status === "APPROVED" && (
          <Button size="sm" variant="secondary" onClick={() => act.mutate({ action: "PAUSE" })} disabled={act.isPending}>
            <Pause className="h-4 w-4" aria-hidden /> Pause
          </Button>
        )}
        {l.status !== "ARCHIVED" && (
          <Button size="sm" variant="secondary" onClick={() => act.mutate({ action: "ARCHIVE" })} disabled={act.isPending}>
            <Archive className="h-4 w-4" aria-hidden /> Archive
          </Button>
        )}
        {l.status === "SUBMITTED" && !rejecting && (
          <Button size="sm" variant="secondary" onClick={() => setRejecting(true)}>
            Reject…
          </Button>
        )}
        {v.isPublic && (
          <Button size="sm" variant="ghost" asChild>
            <a href={`/distributors/${l.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden /> View on site
            </a>
          </Button>
        )}
        {l.enquiryCount > 0 && (
          <Button size="sm" variant="ghost" asChild>
            <Link to={`/enquiries?distributorId=${l.id}`}>
              <Inbox className="h-4 w-4" aria-hidden /> Enquiries
            </Link>
          </Button>
        )}
      </div>
      {rejecting && (
        <div className="mt-3 space-y-2">
          <Field label="Reason (kept in the activity log)">{(fid) => <TextInput id={fid} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}</Field>
          <div className="flex gap-2">
            <Button size="sm" disabled={!reason.trim() || act.isPending} onClick={() => act.mutate({ action: "REJECT", reason: reason.trim() })}>
              Confirm rejection
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {superAdmin && (
        <div className="mt-4 border-t border-line pt-3">
          <DeleteButton what={`"${l.name}", its products and enquiries`} pending={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
        </div>
      )}
      <ErrorLine error={act.error ?? remove.error} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

const blankProduct = { name: "", description: "", categoryId: "", packaging: "", priceLabel: "", imageUrls: [] as string[], published: true };
type ProductForm = typeof blankProduct;
const productToForm = (p: AdminProductDTO): ProductForm => ({
  name: p.name,
  description: p.description ?? "",
  imageUrls: p.imageUrls ?? [],
  categoryId: p.categoryId ?? "",
  packaging: p.packaging ?? "",
  priceLabel: p.priceLabel ?? "",
  published: p.published,
});
const formToProduct = (f: ProductForm): AdminProductInput => ({
  name: f.name,
  description: f.description || null,
  imageUrls: f.imageUrls,
  categoryId: f.categoryId || null,
  packaging: f.packaging || null,
  priceLabel: f.priceLabel || null,
  published: f.published,
});

function ProductsSection({ listing, categories }: { listing: AdminListingDTO; categories: CategoryDTO[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg">Products</h2>
          <p className="text-sm text-muted">Published products appear on the listing and in product search while the listing is visible.</p>
        </div>
        {!adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Add product
          </Button>
        )}
      </div>
      <ul className="mt-4 space-y-3">
        {adding && (
          <li>
            <ProductEditor listingId={listing.id} categories={categories} onDone={() => setAdding(false)} />
          </li>
        )}
        {listing.products.map((p) => (
          <ProductRow key={p.id} listingId={listing.id} product={p} categories={categories} />
        ))}
        {!adding && listing.products.length === 0 && <li className="rounded-card border border-dashed border-line-strong p-6 text-center text-sm text-muted">No products yet.</li>}
      </ul>
    </section>
  );
}

function ProductRow({ listingId, product: p, categories }: { listingId: string; product: AdminProductDTO; categories: CategoryDTO[] }) {
  const [editing, setEditing] = useState(false);
  const remove = useAdminMutation(() => adminApi.deleteProduct(listingId, p.id), [LISTINGS_KEY]);
  if (editing)
    return (
      <li>
        <ProductEditor listingId={listingId} product={p} categories={categories} onDone={() => setEditing(false)} />
      </li>
    );
  return (
    <li>
      <Card className="flex flex-wrap items-center gap-3">
        {p.imageUrls[0] && <img src={p.imageUrls[0]} alt="" className="h-12 w-16 rounded-md object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-ink">{p.name}</div>
          <div className="text-xs text-muted">
            {p.published ? "Published" : "Hidden"}
            {p.priceLabel ? ` · ${p.priceLabel}` : ""}
            {p.packaging ? ` · ${p.packaging}` : ""}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" aria-hidden /> Edit
        </Button>
        <DeleteButton what={`"${p.name}"`} pending={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
        <ErrorLine error={remove.error} />
      </Card>
    </li>
  );
}

function ProductEditor({ listingId, product, categories, onDone }: { listingId: string; product?: AdminProductDTO; categories: CategoryDTO[]; onDone: () => void }) {
  const [f, setF] = useState<ProductForm>(product ? productToForm(product) : blankProduct);
  const save = useAdminMutation(
    (input: AdminProductInput) => (product ? adminApi.updateProduct(listingId, product.id, input) : adminApi.createProduct(listingId, input)),
    [LISTINGS_KEY],
    onDone,
  );
  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const err = (field: string) => fieldError(save.error, field);
  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(formToProduct(f));
        }}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <Field label="Product name" error={err("name")}>
          {(fid) => <TextInput id={fid} value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />}
        </Field>
        <Field label="Category" error={err("categoryId")}>
          {(fid) => <CategorySelect id={fid} value={f.categoryId} onChange={(v) => set("categoryId", v)} categories={categories} />}
        </Field>
        <Field label="Price label" hint='Free text, e.g. "From NPR 500 per carton".' error={err("priceLabel")}>
          {(fid) => <TextInput id={fid} value={f.priceLabel} onChange={(e) => set("priceLabel", e.target.value)} maxLength={80} />}
        </Field>
        <Field label="Packaging" error={err("packaging")}>
          {(fid) => <TextInput id={fid} value={f.packaging} onChange={(e) => set("packaging", e.target.value)} maxLength={200} />}
        </Field>
        <Field label="Description" error={err("description")} className="sm:col-span-2">
          {(fid) => <TextArea id={fid} rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />}
        </Field>
        <div className="sm:col-span-2"><ImageGalleryUpload label="Product photos" kind="product" value={f.imageUrls} onChange={(v) => set("imageUrls", v)} max={8} /></div>
        <div className="sm:col-span-2">
          <Toggle label="Published" hint="Hidden products stay saved but don't appear on the site." checked={f.published} onChange={(v) => set("published", v)} />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending ? "Saving…" : product ? "Save product" : "Add product"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
      <ErrorLine error={save.error && !(save.error as { fields?: object }).fields ? save.error : null} />
    </Card>
  );
}
