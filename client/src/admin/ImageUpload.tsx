import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApi, type MediaKind } from "./api";

const ACCEPT = "image/jpeg,image/png,image/webp";

function useImageUpload(kind: MediaKind, onUpload: (url: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUpload((await adminApi.uploadImage(kind, file)).url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return { busy, error, input, pick };
}

export function ImageUpload({ label, kind, value, onChange, alt = "Image preview", aspect = "aspect-video", error }: { label: string; kind: MediaKind; value: string; onChange: (url: string) => void; alt?: string; aspect?: string; error?: string }) {
  const upload = useImageUpload(kind, onChange);
  const inputId = useId();
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{label}</p>
      {value ? (
        <div className="relative max-w-xl overflow-hidden rounded-xl border border-line bg-slate-50">
          <img src={value} alt={alt} className={`w-full object-contain ${aspect} max-h-64`} />
          <button type="button" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => onChange("")} className="absolute right-2 top-2 rounded-full bg-white p-2 text-ink shadow hover:text-danger"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <label htmlFor={inputId} className="flex min-h-28 max-w-xl cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-slate-50 px-4 py-5 text-center text-sm text-muted hover:border-primary hover:text-primary">
          {upload.busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span>{upload.busy ? "Uploading image…" : "Choose a JPG, PNG or WebP image"}</span>
          <span className="text-xs">Up to 12 MB</span>
        </label>
      )}
      {value && (
        <Button type="button" size="sm" variant="secondary" disabled={upload.busy} onClick={() => upload.input.current?.click()}>
          {upload.busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Replace image
        </Button>
      )}
      <input id={inputId} ref={upload.input} type="file" accept={ACCEPT} className="sr-only" disabled={upload.busy} onChange={(e) => void upload.pick(e.currentTarget.files?.[0])} />
      {upload.error && <p role="alert" className="text-sm text-danger">{upload.error}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function ImageGalleryUpload({ label, kind, value, onChange, max }: { label: string; kind: MediaKind; value: string[]; onChange: (urls: string[]) => void; max: number }) {
  const upload = useImageUpload(kind, (url) => onChange([...value, url].slice(0, max)));
  const move = (i: number, delta: number) => {
    const next = [...value];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between"><p className="text-sm font-medium text-ink">{label}</p><span className="text-xs text-muted">{value.length}/{max}</span></div>
      {value.length > 0 && <ul className="flex flex-wrap gap-3">{value.map((url, i) => (
        <li key={url} className="relative h-28 w-36 overflow-hidden rounded-lg border border-line bg-slate-50">
          <img src={url} alt={`${label} ${i + 1}`} className="h-full w-full object-cover" />
          <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1">
            <button type="button" aria-label="Move image earlier" disabled={i === 0} onClick={() => move(i, -1)} className="rounded bg-white/95 p-1 text-ink disabled:opacity-40"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Move image later" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="rounded bg-white/95 p-1 text-ink disabled:opacity-40"><ArrowDown className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Remove image" onClick={() => onChange(value.filter((_, n) => n !== i))} className="rounded bg-white/95 p-1 text-ink hover:text-danger"><X className="h-3.5 w-3.5" /></button>
          </div>
        </li>
      ))}</ul>}
      {value.length < max && <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-button border border-line-strong px-3 text-sm font-medium text-ink hover:border-primary hover:text-primary">
        {upload.busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{upload.busy ? "Uploading…" : "Add image"}
        <input ref={upload.input} type="file" accept={ACCEPT} className="sr-only" disabled={upload.busy} onChange={(e) => void upload.pick(e.currentTarget.files?.[0])} />
      </label>}
      {upload.error && <p role="alert" className="text-sm text-danger">{upload.error}</p>}
    </div>
  );
}
