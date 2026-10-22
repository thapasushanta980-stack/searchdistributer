import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, MousePointerClick, Eye, Pause, Play, Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AD_PLACEMENTS, AD_PLACEMENT_LABELS, AD_STATUSES, AD_STATUS_LABELS, type AdminAdAction, type AdminAdDTO, type AdminAdInput } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { Badge } from "@/components/ui/misc";
import { adminApi } from "./api";
import {
  Card,
  DeleteButton,
  ErrorLine,
  Field,
  ListState,
  Meta,
  PageHeader,
  Pager,
  SearchBox,
  Section,
  Select,
  StatusBadge,
  Tabs,
  TextArea,
  TextInput,
  Toggle,
  Toolbar,
  fieldError,
  fmtDate,
  fromDateInput,
  qs,
  toDateInput,
  useAdminMutation,
  useFilters,
  useIsSuperAdmin,
} from "./ui";

const KEY = ["admin", "ads"];
const ctr = (a: { impressions: number; clicks: number }) => (a.impressions ? `${((a.clicks / a.impressions) * 100).toFixed(1)}%` : "—");

export function AdsPage() {
  const { values, page, set } = useFilters(["status", "placement", "q"] as const);
  const list = useQuery({ queryKey: [...KEY, values, page], queryFn: () => adminApi.ads(qs({ ...values, page })), placeholderData: (p) => p });

  return (
    <>
      <PageHeader
        title="Advertising"
        description="Campaigns run only when approved, marked paid and inside their dates."
        actions={
          <Button size="sm" asChild>
            <Link to="/ads/new">
              <Plus className="h-4 w-4" aria-hidden /> New campaign
            </Link>
          </Button>
        }
      />
      <Tabs
        label="Status"
        value={values.status}
        onChange={(v) => set({ status: v })}
        options={[{ value: "", label: "All" }, ...AD_STATUSES.map((s) => ({ value: s, label: AD_STATUS_LABELS[s] }))]}
      />
      <Toolbar>
        <SearchBox value={values.q} onChange={(v) => set({ q: v })} placeholder="Search advertiser or headline…" />
        <Select aria-label="Placement" value={values.placement} onChange={(e) => set({ placement: e.target.value })} className="w-auto">
          <option value="">All placements</option>
          {AD_PLACEMENTS.map((p) => (
            <option key={p} value={p}>
              {AD_PLACEMENT_LABELS[p]}
            </option>
          ))}
        </Select>
      </Toolbar>
      <ListState
        query={list}
        empty={
          values.q || values.status || values.placement ? (
            "No campaigns match these filters."
          ) : (
            <>
              No campaigns yet.{" "}
              <Link to="/ads/new" className="text-primary hover:underline">
                Create one
              </Link>
              . Until then the site shows "Advertise with us" in each slot.
            </>
          )
        }
      >
        <ul className="mt-5 space-y-3">
          {list.data?.data.map((a) => (
            <li key={a.id}>
              <Link to={`/ads/${a.id}`} className="block transition-shadow hover:shadow-card-hover">
                <Card className="flex gap-4">
                  {a.imageUrl ? <img src={a.imageUrl} alt="" className="hidden h-16 w-28 shrink-0 rounded-input object-cover sm:block" loading="lazy" /> : null}
                  <div className="min-w-0 flex-1">
                    <Meta>
                      <span>{AD_PLACEMENT_LABELS[a.placement]}</span>
                      <StatusBadge status={a.status} label={AD_STATUS_LABELS[a.status]} />
                      {a.isLive ? <StatusBadge status="LIVE" label="Showing now" /> : <Badge tone="neutral">Not showing</Badge>}
                      {!a.paymentVerified && <Badge tone="dark">Unpaid</Badge>}
                    </Meta>
                    <h2 className="mt-1.5 truncate text-base sm:text-lg">{a.headline}</h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span>{a.advertiserName}</span>
                      <span>
                        {fmtDate(a.startsAt)} – {fmtDate(a.endsAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" aria-hidden /> {a.impressions.toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="h-3.5 w-3.5" aria-hidden /> {a.clicks.toLocaleString()} ({ctr(a)})
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </ListState>
      <Pager pagination={list.data?.pagination} onPage={(p) => set({ page: String(p) })} />
    </>
  );
}

interface AdForm {
  placement: AdminAdInput["placement"];
  advertiserName: string;
  headline: string;
  description: string;
  ctaLabel: string;
  destinationUrl: string;
  imageUrl: string;
  imageAlt: string;
  startsAt: string;
  endsAt: string;
  weight: string;
  paymentVerified: boolean;
  internalNotes: string;
}

const today = () => toDateInput(new Date().toISOString());
const blank = (): AdForm => ({
  placement: "HOME_HERO_BANNER",
  advertiserName: "",
  headline: "",
  description: "",
  ctaLabel: "Learn more",
  destinationUrl: "",
  imageUrl: "",
  imageAlt: "",
  startsAt: today(),
  endsAt: toDateInput(new Date(Date.now() + 30 * 86_400_000).toISOString()),
  weight: "1",
  paymentVerified: false,
  internalNotes: "",
});
const fromAd = (a: AdminAdDTO): AdForm => ({
  placement: a.placement,
  advertiserName: a.advertiserName,
  headline: a.headline,
  description: a.description ?? "",
  ctaLabel: a.ctaLabel,
  destinationUrl: a.destinationUrl,
  imageUrl: a.imageUrl ?? "",
  imageAlt: a.imageAlt ?? "",
  startsAt: toDateInput(a.startsAt),
  endsAt: toDateInput(a.endsAt),
  weight: String(a.weight),
  paymentVerified: a.paymentVerified,
  internalNotes: a.internalNotes ?? "",
});
const toInput = (f: AdForm, fromLeadId?: string): AdminAdInput => ({
  placement: f.placement,
  advertiserName: f.advertiserName,
  headline: f.headline,
  description: f.description || null,
  ctaLabel: f.ctaLabel || "Learn more",
  destinationUrl: f.destinationUrl,
  imageUrl: f.imageUrl || null,
  imageAlt: f.imageAlt || null,
  startsAt: fromDateInput(f.startsAt, false) ?? "",
  endsAt: fromDateInput(f.endsAt) ?? "",
  weight: Number(f.weight) || 1,
  paymentVerified: f.paymentVerified,
  internalNotes: f.internalNotes || null,
  ...(fromLeadId ? { fromLeadId } : {}),
});

export function AdEditPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const [searchParams] = useSearchParams();
  const leadId = isNew ? searchParams.get("fromLead") ?? undefined : undefined;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ad = useQuery({ queryKey: [...KEY, "one", id], queryFn: () => adminApi.ad(id!), enabled: !isNew });
  const lead = useQuery({ queryKey: ["admin", "leads", "one", leadId], queryFn: () => adminApi.lead(leadId!), enabled: !!leadId });
  const [form, setForm] = useState<AdForm>(blank);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    if (ad.data && loadedFor !== ad.data.updatedAt) {
      setForm(fromAd(ad.data));
      setLoadedFor(ad.data.updatedAt);
    }
    if (isNew && lead.data && loadedFor !== lead.data.id) {
      setForm({ ...blank(), advertiserName: lead.data.companyName ?? lead.data.name, placement: lead.data.adPlacement ?? "HOME_HERO_BANNER", internalNotes: `Contact: ${lead.data.name}${lead.data.phone ? ` · ${lead.data.phone}` : ""}${lead.data.email ? ` · ${lead.data.email}` : ""}` });
      setLoadedFor(lead.data.id);
    }
  }, [ad.data, isNew, lead.data, loadedFor]);
  const set = <K extends keyof AdForm>(k: K, v: AdForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useAdminMutation((input: AdminAdInput) => (isNew ? adminApi.createAd(input) : adminApi.updateAd(id!, input)), [KEY], (saved) => {
    qc.setQueryData([...KEY, "one", saved.id], saved);
    if (isNew) navigate(`/ads/${saved.id}`, { replace: true });
  });
  const err = (f: string) => fieldError(save.error, f);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(toInput(form, leadId));
  };

  if (!isNew && ad.isLoading) return <div className="skeleton h-96 w-full rounded-card" aria-busy="true" />;
  if (!isNew && ad.isError) return <ErrorLine error={ad.error} />;

  return (
    <>
      <Link to="/ads" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Advertising
      </Link>
      <PageHeader title={isNew ? "New campaign" : (ad.data?.headline ?? "Campaign")} description={isNew ? (lead.data ? `Prefilled from advertising request ${lead.data.reference}.` : "Saved as a draft. Approve it and mark it paid to run it.") : undefined} />
      {ad.data && <AdStatusPanel ad={ad.data} />}

      <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
        <Section title="Creative">
          <Field label="Placement" error={err("placement")}>
            {(fid) => (
              <Select id={fid} value={form.placement} onChange={(e) => set("placement", e.target.value as AdForm["placement"])}>
                {AD_PLACEMENTS.map((p) => (
                  <option key={p} value={p}>
                    {AD_PLACEMENT_LABELS[p]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Advertiser" error={err("advertiserName")}>
            {(fid) => <TextInput id={fid} value={form.advertiserName} onChange={(e) => set("advertiserName", e.target.value)} maxLength={120} />}
          </Field>
          <Field label="Headline" error={err("headline")} className="sm:col-span-2">
            {(fid) => <TextInput id={fid} value={form.headline} onChange={(e) => set("headline", e.target.value)} maxLength={120} />}
          </Field>
          <Field label="Description" error={err("description")} className="sm:col-span-2">
            {(fid) => <TextArea id={fid} rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={300} />}
          </Field>
          <Field label="Button label" error={err("ctaLabel")}>
            {(fid) => <TextInput id={fid} value={form.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} maxLength={40} />}
          </Field>
          <Field label="Destination link" hint="Where a click goes (https://)." error={err("destinationUrl")}>
            {(fid) => <TextInput id={fid} type="url" value={form.destinationUrl} onChange={(e) => set("destinationUrl", e.target.value)} placeholder="https://" />}
          </Field>
          <div className="sm:col-span-2"><ImageUpload label="Ad image" kind="ad" value={form.imageUrl} onChange={(v) => set("imageUrl", v)} alt={form.imageAlt || form.headline || "Advertisement"} error={err("imageUrl")} /></div>
          <Field label="Image description" hint="Read aloud by screen readers. Required with an image." error={err("imageAlt")}>
            {(fid) => <TextInput id={fid} value={form.imageAlt} onChange={(e) => set("imageAlt", e.target.value)} maxLength={200} />}
          </Field>
        </Section>

        <details className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Advanced campaign settings</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Starts" error={err("startsAt")}>
            {(fid) => <TextInput id={fid} type="date" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />}
          </Field>
          <Field label="Ends" hint="Runs until the end of this day." error={err("endsAt")}>
            {(fid) => <TextInput id={fid} type="date" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />}
          </Field>
          <Field label="Weight" hint="1–10. Higher shows more often when several ads share a slot." error={err("weight")}>
            {(fid) => (
              <Select id={fid} value={form.weight} onChange={(e) => set("weight", e.target.value)}>
                {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="self-end">
            <Toggle label="Payment received" hint="Unpaid campaigns never run." checked={form.paymentVerified} onChange={(v) => set("paymentVerified", v)} />
          </div>
          <Field label="Internal notes" hint="Private. Invoice numbers, contacts, terms." error={err("internalNotes")} className="sm:col-span-2">
            {(fid) => <TextArea id={fid} rows={3} value={form.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} maxLength={2000} />}
          </Field>
          </div>
        </details>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
          <Button type="submit" disabled={save.isPending}>
            <Check className="h-4 w-4" aria-hidden /> {save.isPending ? "Saving…" : isNew ? "Create draft" : "Save changes"}
          </Button>
          {save.isSuccess && !save.isPending && <span className="text-sm text-success">Saved.</span>}
          {save.error && ((save.error as { fields?: object }).fields ? <span className="text-sm text-danger">Check the highlighted fields.</span> : <ErrorLine error={save.error} />)}
        </div>
      </form>
    </>
  );
}

function AdStatusPanel({ ad: a }: { ad: AdminAdDTO }) {
  const superAdmin = useIsSuperAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const act = useAdminMutation((x: AdminAdAction) => adminApi.adAction(a.id, x), [KEY], (saved) => qc.setQueryData([...KEY, "one", saved.id], saved));
  const remove = useAdminMutation(() => adminApi.deleteAd(a.id), [KEY], () => navigate("/ads", { replace: true }));
  const now = Date.now();
  const why = a.isLive
    ? null
    : a.status !== "APPROVED"
      ? "Not approved."
      : !a.paymentVerified
        ? "Payment not marked as received."
        : new Date(a.startsAt).getTime() > now
          ? `Starts ${fmtDate(a.startsAt)}.`
          : new Date(a.endsAt).getTime() <= now
            ? `Ended ${fmtDate(a.endsAt)}.`
            : "Not eligible.";

  return (
    <Card className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={a.status} label={AD_STATUS_LABELS[a.status]} />
        {a.isLive ? <StatusBadge status="LIVE" label="Showing now" /> : <Badge tone="neutral">Not showing{why ? ` · ${why}` : ""}</Badge>}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
        {[
          ["Impressions", a.impressions.toLocaleString()],
          ["Clicks", a.clicks.toLocaleString()],
          ["Click rate", ctr(a)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-input bg-background p-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-display text-xl font-bold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {["DRAFT", "PENDING_REVIEW", "REJECTED"].includes(a.status) && (
          <Button size="sm" onClick={() => act.mutate({ action: "APPROVE" })} disabled={act.isPending}>
            <Check className="h-4 w-4" aria-hidden /> Approve
          </Button>
        )}
        {["DRAFT", "PENDING_REVIEW"].includes(a.status) && !rejecting && (
          <Button size="sm" variant="secondary" onClick={() => setRejecting(true)}>
            <X className="h-4 w-4" aria-hidden /> Reject…
          </Button>
        )}
        {a.status === "APPROVED" && (
          <Button size="sm" variant="secondary" onClick={() => act.mutate({ action: "PAUSE" })} disabled={act.isPending}>
            <Pause className="h-4 w-4" aria-hidden /> Pause
          </Button>
        )}
        {a.status === "PAUSED" && (
          <Button size="sm" onClick={() => act.mutate({ action: "RESUME" })} disabled={act.isPending}>
            <Play className="h-4 w-4" aria-hidden /> Resume
          </Button>
        )}
        {superAdmin && (
          <span className="ml-auto">
            <DeleteButton what="this campaign" pending={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
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
