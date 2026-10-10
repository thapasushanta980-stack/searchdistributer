import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  COVERAGE_LABELS,
  COVERAGE_SCOPES,
  type BusinessType,
  type CategoryDTO,
  type CoverageScope,
  type DistributorSearchParams,
  type FacetsResponse,
} from "@sd/shared";
import { CheckboxField } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/form";
import { Collapsible, RangeSlider } from "@/components/ui/misc";
import { formatMoney, useDebouncedValue } from "@/lib/utils";

export type FilterValue = Pick<
  DistributorSearchParams,
  "category" | "subcategory" | "location" | "coverage" | "businessType" | "verified" | "reviewed" | "investmentMin" | "investmentMax"
>;

interface Props {
  value: FilterValue;
  onChange: (patch: Partial<FilterValue>) => void;
  categories: CategoryDTO[];
  facets: FacetsResponse | undefined;
  /** Hide the top-level category group (category landing pages are already scoped). */
  hideCategory?: boolean;
  hideBusinessType?: boolean;
  idPrefix: string;
}

const toggle = <T extends string>(list: T[], item: T, on: boolean): T[] => (on ? [...new Set([...list, item])] : list.filter((x) => x !== item));

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <legend className="mb-2 float-left w-full text-sm font-semibold text-ink">{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

function niceStep(range: number): number {
  const raw = range / 100;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  return Math.max(1, Math.round(raw / pow) * pow);
}

export function FilterPanel({ value, onChange, categories, facets, hideCategory, hideBusinessType, idPrefix }: Props) {
  const [catSearch, setCatSearch] = useState("");
  const [locText, setLocText] = useState(value.location ?? "");
  const debLoc = useDebouncedValue(locText, 300);

  // Keep the text box in sync when the URL changes elsewhere (hero field, clear all, back button).
  useEffect(() => setLocText(value.location ?? ""), [value.location]);
  useEffect(() => {
    const next = debLoc.trim() || undefined;
    if (next !== value.location) onChange({ location: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debLoc]);

  const bounds = facets?.investment ?? null;
  const [range, setRange] = useState<[number, number]>([bounds?.min ?? 0, bounds?.max ?? 0]);
  useEffect(() => {
    if (bounds) setRange([value.investmentMin ?? bounds.min, value.investmentMax ?? bounds.max]);
  }, [bounds, value.investmentMin, value.investmentMax]);

  const filteredCats = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    return categories.filter((c) => !q || c.name.toLowerCase().includes(q) || c.children.some((ch) => ch.name.toLowerCase().includes(q)));
  }, [categories, catSearch]);

  const visibleCats = catSearch ? filteredCats : filteredCats.slice(0, 6);
  const hierarchy = hideCategory ? categories : filteredCats.filter((c) => c.children.length);

  const moreCount = value.subcategory.length + value.coverage.length + (value.investmentMin !== undefined || value.investmentMax !== undefined ? 1 : 0);

  return (
    <div className="space-y-0">
      {!hideCategory && (
        <Group title="Category">
          <div className="relative mb-2">
            <label htmlFor={`${idPrefix}-catq`} className="sr-only">
              Search categories
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input id={`${idPrefix}-catq`} value={catSearch} onChange={(e) => setCatSearch(e.target.value)} placeholder="Search categories..." className="h-10 pl-9 text-sm" />
          </div>
          {visibleCats.map((c) => (
            <CheckboxField key={c.slug} label={c.name} count={c.distributorCount} checked={value.category.includes(c.slug)} onCheckedChange={(on) => onChange({ category: toggle(value.category, c.slug, on) })} />
          ))}
          {!visibleCats.length && <p className="px-1 py-2 text-sm text-muted">No categories match “{catSearch}”.</p>}
          <Link to="/categories" className="mt-1.5 inline-block px-1 text-sm font-medium text-primary hover:underline">
            View all categories
          </Link>
        </Group>
      )}

      <Group title="Location">
        <label htmlFor={`${idPrefix}-loc`} className="sr-only">
          Search city or region
        </label>
        <Input id={`${idPrefix}-loc`} value={locText} onChange={(e) => setLocText(e.target.value)} placeholder="Search city or region" className="mb-2 h-10 text-sm" />
      </Group>

      {!hideBusinessType && (
      <Group title="Business Type">
        {BUSINESS_TYPES.map((t: BusinessType) => (
          <CheckboxField key={t} label={BUSINESS_TYPE_LABELS[t]} checked={value.businessType.includes(t)} onCheckedChange={(on) => onChange({ businessType: toggle(value.businessType, t, on) })} />
        ))}
      </Group>
      )}

      <Group title="Verification">
        <CheckboxField label="Verified Business" checked={value.verified} onCheckedChange={(on) => onChange({ verified: on, ...(on ? { reviewed: false } : {}) })} />
        <CheckboxField label="Profile Reviewed" checked={value.reviewed} onCheckedChange={(on) => onChange({ reviewed: on })} />
      </Group>

      <Collapsible title="More filters" count={moreCount}>
        <div className="pt-2">
      {hierarchy.length > 0 && (
        <Group title="Product Categories">
          <div className="space-y-0.5">
            {hierarchy.map((parent) => {
              const selected = parent.children.filter((ch) => value.subcategory.includes(ch.slug)).length;
              return (
                <Collapsible key={parent.slug} title={parent.name} count={selected} defaultOpen={selected > 0}>
                  {parent.children.map((ch) => (
                    <CheckboxField key={ch.slug} label={ch.name} count={ch.distributorCount} checked={value.subcategory.includes(ch.slug)} onCheckedChange={(on) => onChange({ subcategory: toggle(value.subcategory, ch.slug, on) })} />
                  ))}
                </Collapsible>
              );
            })}
          </div>
        </Group>
      )}

          <Group title="Coverage">
        {COVERAGE_SCOPES.map((s: CoverageScope) => (
          <CheckboxField key={s} label={COVERAGE_LABELS[s]} checked={value.coverage.includes(s)} onCheckedChange={(on) => onChange({ coverage: toggle(value.coverage, s, on) })} />
        ))}
          </Group>
      <Group title="Investment Range">
        {bounds ? (
          <div className="px-1">
            <RangeSlider
              min={bounds.min}
              max={bounds.max}
              step={niceStep(bounds.max - bounds.min)}
              value={range}
              onValueChange={setRange}
              onValueCommit={([lo, hi]) =>
                onChange({
                  investmentMin: lo <= bounds.min ? undefined : lo,
                  investmentMax: hi >= bounds.max ? undefined : hi,
                })
              }
              labels={["Minimum investment", "Maximum investment"]}
            />
            <div className="mt-2 flex justify-between text-xs font-medium tabular-nums text-slate-600" aria-live="polite">
              <span>{formatMoney(range[0], bounds.currency)}</span>
              <span>{formatMoney(range[1], bounds.currency)}</span>
            </div>
          </div>
        ) : (
          <p className="px-1 text-sm text-muted">Investment information is not yet available for current listings.</p>
        )}
      </Group>
        </div>
      </Collapsible>
    </div>
  );
}
