import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m } from "framer-motion";
import { Building2, Loader2, MapPin, Search, Tag } from "lucide-react";
import { useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { CategoryDTO } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/context";
import { categoriesQuery, suggestQuery } from "@/lib/queries";
import { cn, useDebouncedValue } from "@/lib/utils";

interface Option {
  key: string;
  label: string;
  hint: string;
  icon: "category" | "company" | "location";
  onPick: () => void;
}

interface Props {
  keyword: string;
  location: string;
  onKeywordChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onSubmit: () => void;
  onPickCategory: (slug: string) => void;
  /** Shows the animated search indicator. */
  loading?: boolean;
  /** Optional category dropdown rendered inside the panel. */
  categories?: CategoryDTO[];
  category?: string;
  onCategoryChange?: (slug: string) => void;
  placeholder?: string;
}

const ICONS = { category: Tag, company: Building2, location: MapPin } as const;

function Combobox({
  label,
  placeholder,
  icon: Icon,
  value,
  onChange,
  options,
  onEnterWithoutSelection,
  className,
}: {
  label: string;
  placeholder: string;
  icon: typeof Search;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  onEnterWithoutSelection: () => void;
  className?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const expanded = open && options.length > 0;

  const pick = (o: Option) => {
    o.onPick();
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (options.length ? (i <= 0 ? options.length - 1 : i - 1) : -1));
    } else if (e.key === "Enter") {
      const o = options[active];
      if (expanded && o) {
        e.preventDefault();
        pick(o);
      } else {
        onEnterWithoutSelection();
      }
    } else if (e.key === "Escape") {
      if (expanded) {
        e.preventDefault();
        setOpen(false);
      }
    }
  };

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        {label}
      </label>
      <Icon className={cn("pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400", Icon === Loader2 && "animate-spin text-primary")} aria-hidden />
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => {
          clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        className="h-14 w-full rounded-xl bg-transparent pl-12 pr-3 text-base text-ink placeholder:text-slate-400 focus:outline-none"
      />
      <AnimatePresence>
        {expanded && (
          <m.ul
            id={listId}
            role="listbox"
            aria-label={`${label} suggestions`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 max-h-80 overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-panel"
          >
            {options.map((o, i) => {
              const OIcon = ICONS[o.icon];
              return (
                <li
                  key={o.key}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm", i === active ? "bg-primary-soft text-primary-dark" : "text-ink")}
                >
                  <OIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <span className="flex-1 truncate">{o.label}</span>
                  <span className="text-xs text-muted">{o.hint}</span>
                </li>
              );
            })}
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SearchPanel({ keyword, location, onKeywordChange, onLocationChange, onSubmit, onPickCategory, loading, categories: catList, category, onCategoryChange, placeholder }: Props) {
  const api = useApi();
  const navigate = useNavigate();
  const { data: categories } = useQuery(categoriesQuery(api));
  const debKeyword = useDebouncedValue(keyword.trim(), 200);
  const debLocation = useDebouncedValue(location.trim(), 200);
  const { data: kwSuggest, isFetching: kwFetching } = useQuery(suggestQuery(api, debKeyword));
  const { data: locSuggest } = useQuery(suggestQuery(api, debLocation));

  const keywordOptions = useMemo<Option[]>(() => {
    if (keyword.trim().length < 2) {
      // Empty field: offer the live top-level categories as starting points.
      return (categories ?? [])
        .filter((c) => c.distributorCount > 0)
        .slice(0, 6)
        .map((c) => ({ key: `c-${c.slug}`, label: `${c.name} distributors`, hint: `${c.distributorCount}`, icon: "category" as const, onPick: () => onPickCategory(c.slug) }));
    }
    return (kwSuggest?.data ?? [])
      .filter((s) => s.type !== "location")
      .map((s) => ({
        key: `${s.type}-${s.value}`,
        label: s.label,
        hint: s.type === "category" ? "Category" : "Company",
        icon: s.type === "category" ? ("category" as const) : ("company" as const),
        onPick: () => {
          if (s.type === "category" && s.href) onPickCategory(s.href.split("/").pop()!);
          else if (s.href) navigate(s.href);
        },
      }));
  }, [keyword, kwSuggest, categories, onPickCategory, navigate]);

  const locationOptions = useMemo<Option[]>(
    () =>
      (locSuggest?.data ?? [])
        .filter((s) => s.type === "location")
        .map((s) => ({ key: `l-${s.value}`, label: s.label, hint: "Location", icon: "location" as const, onPick: () => onLocationChange(s.value) })),
    [locSuggest, onLocationChange],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form
      role="search"
      aria-label="Search distributors"
      onSubmit={submit}
      className={`relative grid gap-1 rounded-[20px] border border-line bg-white p-2 shadow-panel transition-[box-shadow,border-color] duration-300 focus-within:border-primary focus-within:shadow-[0_24px_60px_-18px_rgb(49_86_211/0.38),0_0_0_4px_rgb(49_86_211/0.1)] ${onCategoryChange ? "md:grid-cols-[1.6fr_1fr_1.05fr_auto]" : "md:grid-cols-[1.5fr_1fr_auto]"} md:items-center md:gap-0`}
    >
      <Combobox
        label="Search by product, brand, company or keyword"
        placeholder={placeholder ?? "Search by product, brand, company or keyword"}
        icon={kwFetching ? Loader2 : Search}
        value={keyword}
        onChange={onKeywordChange}
        options={keywordOptions}
        onEnterWithoutSelection={onSubmit}
      />
      <Combobox
        label="Location"
        placeholder="Location"
        icon={MapPin}
        value={location}
        onChange={onLocationChange}
        options={locationOptions}
        onEnterWithoutSelection={onSubmit}
        className="border-t border-line md:my-1 md:border-l md:border-t-0"
      />
      {onCategoryChange && (
        <div className="relative border-t border-line md:my-1 md:border-l md:border-t-0">
          <label htmlFor="hero-category" className="sr-only">
            Category
          </label>
          <select
            id="hero-category"
            value={category ?? ""}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="h-14 w-full cursor-pointer appearance-none rounded-xl bg-transparent px-4 pr-8 text-base text-ink focus:outline-none"
          >
            <option value="">All Categories</option>
            {(catList ?? []).map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <Button type="submit" size="lg" className="mt-1 h-14 rounded-xl px-7 md:mt-0 md:ml-2">
        <Search className="h-5 w-5" aria-hidden />
        Search
      </Button>
      {loading && <span aria-hidden className="search-sweep pointer-events-none absolute inset-x-6 bottom-0 h-0.5 overflow-hidden rounded-full" />}
    </form>
  );
}
