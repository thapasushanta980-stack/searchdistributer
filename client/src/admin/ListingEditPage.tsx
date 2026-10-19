import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CircleSlash, ExternalLink, Inbox, Pause, Pencil, Plus, Rocket, Archive } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  COVERAGE_LABELS,
  COVERAGE_SCOPES,
  LISTING_STATUS_LABELS,
  VERIFICATION_LABELS,
  VERIFICATION_STATUSES,
  type AdminLeadDTO,
  type AdminListingAction,
  type AdminListingDTO,
  type AdminListingInput,
  type AdminProductDTO,
  type AdminProductInput,
  type CategoryDTO,
} from "@sd/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adminApi } from "./api";
import { LISTINGS_KEY } from "./ListingsPage";
import {
  Card,
  DeleteButton,
  ErrorLine,
  Field,
  PageHeader,
  Section,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
  Toggle,
  fieldError,
  fmtDate,
  fromDateInput,
  splitList,
  toDateInput,
  useAdminMutation,
  useIsSuperAdmin,
} from "./ui";

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
  territories: string;
  specialties: string;
  website: string;
  logoUrl: string;
  contactPerson: string;
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
  city: "",
  country: "",
  coverage: "NATIONAL",
  territories: "",
  specialties: "",
  website: "",
  logoUrl: "",
  contactPerson: "",
  notificationEmail: "",
  foundedYear: "",
  distributorshipInfo: "",
  minimumOrder: "",
  supportOffered: "",
  investmentMin: "",
  investmentMax: "",
  investmentCurrency: "",
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
  territories: l.territories.join(", "),
  specialties: l.specialties.join(", "),
  website: l.website ?? "",
  logoUrl: l.logoUrl ?? "",
  contactPerson: l.contactPerson ?? "",
  notificationEmail: l.notificationEmail ?? "",
  foundedYear: l.foundedYear ? String(l.foundedYear) : "",
  distributorshipInfo: l.distributorshipInfo ?? "",
  minimumOrder: l.minimumOrder ?? "",
  supportOffered: l.supportOffered ?? "",
  investmentMin: l.investmentMin !== null ? String(l.investmentMin) : "",
  investmentMax: l.investmentMax !== null ? String(l.investmentMax) : "",
  investmentCurrency: l.investmentCurrency ?? "",
  verificationStatus: l.verificationStatus,
  isFeatured: l.isFeatured,
  featuredUntil: toDateInput(l.featuredUntil),
  listedUntil: toDateInput(l.listedUntil),
});

/** Prefill from a business registration lead. */
const fromLead = (lead: AdminLeadDTO, categories: CategoryDTO[]): FormState => {
  const cat = categories.flatMap((c) => [c, ...c.children]).find((c) => c.slug === lead.categorySlug);
  return {
    ...blank,
    name: lead.companyName ?? lead.name,
    contactPerson: lead.name,
    notificationEmail: lead.email,
    location: lead.location ?? "",
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
  city: f.city || null,
  country: f.country || null,
  coverage: f.coverage,
  territories: splitList(f.territories),
  specialties: splitList(f.specialties),
  website: f.website || null,
  logoUrl: f.logoUrl || null,
  contactPerson: f.contactPerson || null,
  notificationEmail: f.notificationEmail || null,
  foundedYear: num(f.foundedYear),
  distributorshipInfo: f.distributorshipInfo || null,
  minimumOrder: f.minimumOrder || null,
  supportOffered: f.supportOffered || null,
  investmentMin: num(f.investmentMin),
  investmentMax: num(f.investmentMax),
  investmentCurrency: f.investmentCurrency || null,
  verificationStatus: f.verificationStatus,
  isFeatured: f.isFeatured,
  featuredUntil: fromDateInput(f.featuredUntil),
  listedUntil: fromDateInput(f.listedUntil),
  ...(fromLeadId ? { fromLeadId } : {}),
});

function CategorySelect({ id, value, onChange, categories }: { id: string; value: string; onChange: (v: string) => void; categories: CategoryDTO[] }) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
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
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!isNew && listing.data && loadedFor !== listing.data.updatedAt) {
      setForm(fromListing(listing.data));
      setLoadedFor(listing.data.updatedAt);
    }
    if (isNew && lead.data && categories.data && loadedFor !== lead.data.id) {
      setForm(fromLead(lead.data, categories.data));
      setLoadedFor(lead.data.id);
    }
  }, [isNew, listing.data, lead.data, categories.data, loadedFor]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useAdminMutation(
    (input: AdminListingInput) => (isNew ? adminApi.createListing(input) : adminApi.updateListing(id!, input)),
    [LISTINGS_KEY, ["admin", "leads"]],
    (saved) => {
      qc.setQueryData([...LISTINGS_KEY, "one", saved.id], saved);
      if (isNew) navigate(`/listings/${saved.id}`, { replace: true });
    },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(toInput(form, leadId));
  };
  const err = (field: string) => fieldError(save.error, field);

  if (!isNew && listing.isLoading) return <div className="skeleton h-96 w-full rounded-card" aria-busy="true" />;
  if (!isNew && listing.isError) return <ErrorLine error={listing.error} />;

  const cats = categories.data ?? [];
  const l = listing.data;

  return (
    <>
      <Link to="/listings" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Listings
      </Link>
      <PageHeader title={isNew ? "New listing" : (l?.name ?? "Listing")} description={isNew ? (lead.data ? `Prefilled from lead ${lead.data.reference}. Check every field before saving.` : "Saved as a draft. Publish it once it's ready.") : undefined} />

      {l && <StatusPanel listing={l} />}

      <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
        <Section title="Basics">
          <Field label="Company name" error={err("name")} className="sm:col-span-2">
            {(fid) => <TextInput id={fid} value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} required />}
          </Field>
          <Field label="Business type" error={err("businessType")}>
            {(fid) => (
              <Select id={fid} value={form.businessType} onChange={(e) => set("businessType", e.target.value as FormState["businessType"])}>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {BUSINESS_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Category" error={err("categoryId")} hint={t("Manufacturers appear under Brands.", form.businessType === "MANUFACTURER")}>
            {(fid) => <CategorySelect id={fid} value={form.categoryId} onChange={(v) => set("categoryId", v)} categories={cats} />}
          </Field>
          <Field label="Summary" hint="One or two sentences shown on search cards (10–300 characters)." error={err("summary")} className="sm:col-span-2">
            {(fid) => <TextArea id={fid} rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} maxLength={300} />}
          </Field>
          <Field label="Description" hint="Full profile text (at least 20 characters)." error={err("description")} className="sm:col-span-2">
            {(fid) => <TextArea id={fid} rows={6} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} />}
          </Field>
        </Section>

        <Section title="Location and coverage">
          <Field label="Location" hint='Shown on cards, e.g. "Kathmandu, Nepal".' error={err("location")} className="sm:col-span-2">
            {(fid) => <TextInput id={fid} value={form.location} onChange={(e) => set("location", e.target.value)} maxLength={120} />}
          </Field>
          <Field label="City" error={err("city")}>
            {(fid) => <TextInput id={fid} value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} />}
          </Field>
          <Field label="Country" error={err("country")}>
            {(fid) => <TextInput id={fid} value={form.country} onChange={(e) => set("country", e.target.value)} maxLength={80} />}
          </Field>
          <Field label="Coverage" error={err("coverage")}>
            {(fid) => (
              <Select id={fid} value={form.coverage} onChange={(e) => set("coverage", e.target.value as FormState["coverage"])}>
                {COVERAGE_SCOPES.map((c) => (
                  <option key={c} value={c}>
                    {COVERAGE_LABELS[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Territories served" hint="Separate with commas." error={err("territories")}>
            {(fid) => <TextInput id={fid} value={form.territories} onChange={(e) => set("territories", e.target.value)} placeholder="Bagmati, Gandaki" />}
          </Field>
        </Section>

        <Section title="Contact" description="Enquiries are emailed to the notification email. It is never shown publicly.">
          <Field label="Contact person" error={err("contactPerson")}>
            {(fid) => <TextInput id={fid} value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} maxLength={120} />}
          </Field>
          <Field label="Notification email" error={err("notificationEmail")}>
            {(fid) => <TextInput id={fid} type="email" value={form.notificationEmail} onChange={(e) => set("notificationEmail", e.target.value)} maxLength={200} />}
          </Field>
          <Field label="Website" hint="https://…" error={err("website")}>
            {(fid) => <TextInput id={fid} type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />}
          </Field>
          <Field label="Logo image link" hint="A https:// link to a square image." error={err("logoUrl")}>
            {(fid) => <TextInput id={fid} type="url" value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://" />}
          </Field>
        </Section>

        <Section title="Business details">
          <Field label="Founded (year)" error={err("foundedYear")}>
            {(fid) => <TextInput id={fid} inputMode="numeric" value={form.foundedYear} onChange={(e) => set("foundedYear", e.target.value.replace(/\D/g, "").slice(0, 4))} />}
          </Field>
          <Field label="Specialties" hint="Separate with commas." error={err("specialties")}>
            {(fid) => <TextInput id={fid} value={form.specialties} onChange={(e) => set("specialties", e.target.value)} />}
          </Field>
          <Field label="Minimum order" error={err("minimumOrder")}>
            {(fid) => <TextInput id={fid} value={form.minimumOrder} onChange={(e) => set("minimumOrder", e.target.value)} maxLength={300} />}
          </Field>
          <Field label="Support offered" error={err("supportOffered")}>
            {(fid) => <TextInput id={fid} value={form.supportOffered} onChange={(e) => set("supportOffered", e.target.value)} maxLength={1000} />}
          </Field>
          <Field label="Distributorship terms" error={err("distributorshipInfo")} className="sm:col-span-2">
            {(fid) => <TextArea id={fid} rows={3} value={form.distributorshipInfo} onChange={(e) => set("distributorshipInfo", e.target.value)} maxLength={2000} />}
          </Field>
          <Field label="Investment from" error={err("investmentMin")}>
            {(fid) => <TextInput id={fid} inputMode="numeric" value={form.investmentMin} onChange={(e) => set("investmentMin", e.target.value.replace(/\D/g, ""))} />}
          </Field>
          <Field label="Investment up to" error={err("investmentMax")}>
            {(fid) => <TextInput id={fid} inputMode="numeric" value={form.investmentMax} onChange={(e) => set("investmentMax", e.target.value.replace(/\D/g, ""))} />}
          </Field>
          <Field label="Currency" hint="3 letters, e.g. NPR or USD." error={err("investmentCurrency")}>
            {(fid) => <TextInput id={fid} value={form.investmentCurrency} onChange={(e) => set("investmentCurrency", e.target.value.toUpperCase().slice(0, 3))} maxLength={3} />}
          </Field>
        </Section>

        <Section title="Trust and promotion">
          <Field label="Verification" hint="Only claim what you have actually checked." error={err("verificationStatus")}>
            {(fid) => (
              <Select id={fid} value={form.verificationStatus} onChange={(e) => set("verificationStatus", e.target.value as FormState["verificationStatus"])}>
                {VERIFICATION_STATUSES.map((v) => (
                  <option key={v} value={v}>
                    {VERIFICATION_LABELS[v]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Listed until" hint="End of the paid listing period. Required to publish; the listing hides itself after this date." error={err("listedUntil")}>
            {(fid) => <TextInput id={fid} type="date" value={form.listedUntil} onChange={(e) => set("listedUntil", e.target.value)} />}
          </Field>
          <div className="sm:col-span-2">
            <Toggle label="Featured" hint="Shown in the featured strip on search pages." checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} />
          </div>
          {form.isFeatured && (
            <Field label="Featured until" hint="Leave empty to feature with no end date." error={err("featuredUntil")}>
              {(fid) => <TextInput id={fid} type="date" value={form.featuredUntil} onChange={(e) => set("featuredUntil", e.target.value)} />}
            </Field>
          )}
        </Section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
          <Button type="submit" disabled={save.isPending}>
            <Check className="h-4 w-4" aria-hidden /> {save.isPending ? "Saving…" : isNew ? "Create draft" : "Save changes"}
          </Button>
          {save.isSuccess && !save.isPending && <span className="text-sm text-success">Saved.</span>}
          {save.error && !Object.keys((save.error as { fields?: object }).fields ?? {}).length ? <ErrorLine error={save.error} /> : save.error ? <span className="text-sm text-danger">Check the highlighted fields.</span> : null}
        </div>
      </form>

      {l && <ProductsSection listing={l} categories={cats} />}
    </>
  );
}

const t = (text: string, show: boolean) => (show ? text : undefined);

function Check2({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={cn("flex items-center gap-2 text-sm", ok ? "text-ink" : "text-muted")}>
      {ok ? <Check className="h-4 w-4 text-success" aria-hidden /> : <CircleSlash className="h-4 w-4 text-danger" aria-hidden />}
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
    <Card className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={l.status} label={LISTING_STATUS_LABELS[l.status]} />
        {v.isPublic ? <StatusBadge status="LIVE" label="Visible on site" /> : <StatusBadge status="HIDDEN" label="Hidden from site" />}
        <span className="text-xs text-muted">
          /distributors/{l.slug} · {l.enquiryCount} enquiries · created {fmtDate(l.createdAt)}
        </span>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        <Check2 ok={v.approved && v.published} label="Published" />
        <Check2 ok={periodOk} label={periodOk ? `Listing period current (until ${fmtDate(l.listedUntil)})` : "Listing period current (set 'Listed until' and save)"} />
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
        {superAdmin && (
          <span className="ml-auto">
            <DeleteButton what={`"${l.name}", its products and enquiries`} pending={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
          </span>
        )}
      </div>
      {rejecting && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Reason (kept in the activity log)" className="min-w-0 flex-1">
            {(fid) => <TextInput id={fid} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}
          </Field>
          <Button size="sm" disabled={!reason.trim() || act.isPending} onClick={() => act.mutate({ action: "REJECT", reason: reason.trim() })}>
            Confirm rejection
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
        </div>
      )}
      <ErrorLine error={act.error ?? remove.error} />
    </Card>
  );
}

/* ------------------------------ Products --------------------------- */

const blankProduct = { name: "", description: "", categoryId: "", packaging: "", priceLabel: "", published: true };
type ProductForm = typeof blankProduct;
const productToForm = (p: AdminProductDTO): ProductForm => ({
  name: p.name,
  description: p.description ?? "",
  categoryId: p.categoryId ?? "",
  packaging: p.packaging ?? "",
  priceLabel: p.priceLabel ?? "",
  published: p.published,
});
const formToProduct = (f: ProductForm): AdminProductInput => ({
  name: f.name,
  description: f.description || null,
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
  if (editing) return <li><ProductEditor listingId={listingId} product={p} categories={categories} onDone={() => setEditing(false)} /></li>;
  return (
    <li>
      <Card className="flex flex-wrap items-center gap-3">
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
