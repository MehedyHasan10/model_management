"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  IMAGE_ACCEPT,
  checkImageFile,
  compressToWebp,
  formatKb,
  uploadImage,
} from "@/lib/image";

type Pending = {
  key: number;
  preview: string;
  status: "compressing" | "uploading";
  size?: number;
};

type Props = {
  /** Saved image URLs, in order. */
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
  hint: string;
  chooseLabel?: string;
  disabled?: boolean;
  /** Called while any image is still compressing or uploading. */
  onBusyChange?: (busy: boolean) => void;
  /** Click on a saved thumbnail, e.g. to open a full-size viewer. */
  onOpen?: (index: number) => void;
};

/**
 * The one image picker for the app. Every file is compressed to WebP in the
 * browser (see compressToWebp), uploaded, and stored as its URL.
 */
export default function ImageUpload({
  value,
  onChange,
  max,
  hint,
  chooseLabel = max === 1 ? "Choose Photo" : "Choose images",
  disabled = false,
  onBusyChange,
  onOpen,
}: Props) {
  const [pending, setPending] = useState<Pending[]>([]);
  // Final sizes of images added in this session, by URL.
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const latest = useRef(value);
  latest.current = value;
  const nextKey = useRef(0);

  useEffect(() => {
    onBusyChange?.(pending.length > 0);
  }, [pending.length, onBusyChange]);

  // Update the ref at once so two uploads finishing together both stay.
  const change = (next: string[]) => {
    latest.current = next;
    onChange(next);
  };

  const room = max - value.length - pending.length;

  async function add(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (max > 1 && files.length > room) {
      toast.error(`Maximum ${max} images allowed`);
      return;
    }
    for (const file of files) {
      try {
        checkImageFile(file);
      } catch (error) {
        toast.error((error as Error).message);
        return;
      }
    }
    // Show every file right away, then compress one at a time so a batch of
    // large phone photos does not exhaust memory.
    const queued = files.map((file) => ({
      file,
      key: nextKey.current++,
      preview: URL.createObjectURL(file),
    }));
    setPending((list) => [
      ...list,
      ...queued.map(({ key, preview }) => ({
        key,
        preview,
        status: "compressing" as const,
      })),
    ]);
    for (const item of queued) await handle(item);
  }

  async function handle({
    file,
    key,
    preview,
  }: {
    file: File;
    key: number;
    preview: string;
  }) {
    const patch = (next: Partial<Pending>) =>
      setPending((list) =>
        list.map((p) => (p.key === key ? { ...p, ...next } : p)),
      );
    try {
      const webp = await compressToWebp(file);
      patch({ status: "uploading", size: webp.size });
      const { url, size } = await uploadImage(webp);
      setSizes((s) => ({ ...s, [url]: size }));
      change(max === 1 ? [url] : [...latest.current, url]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Image upload failed",
      );
    } finally {
      URL.revokeObjectURL(preview);
      setPending((list) => list.filter((p) => p.key !== key));
    }
  }

  const busy = pending.length > 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label
          className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50 px-4 py-3 font-semibold text-violet-700 ${
            disabled || (max > 1 && room <= 0) || (max === 1 && busy)
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:bg-violet-100"
          } ${max > 1 ? "w-full" : ""}`}
        >
          <ImagePlus size={19} />
          {chooseLabel}
          <input
            type="file"
            multiple={max > 1}
            accept={IMAGE_ACCEPT}
            onChange={add}
            disabled={disabled || (max > 1 && room <= 0) || (max === 1 && busy)}
            className="sr-only"
          />
        </label>
      </div>
      <p className="text-xs text-slate-500">{hint}</p>

      {(value.length > 0 || pending.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-3">
          {(max === 1 && pending.length ? [] : value).map((url, i) => (
            <figure key={`${url.slice(0, 60)}-${i}`} className="relative w-24">
              <button
                type="button"
                disabled={!onOpen}
                onClick={() => onOpen?.(i)}
                className="block"
              >
                <img
                  loading="lazy"
                  decoding="async"
                  src={url}
                  alt={`Image ${i + 1}`}
                  className="h-24 w-24 rounded-xl border object-cover"
                />
              </button>
              {sizes[url] !== undefined && (
                <figcaption className="mt-1 text-center text-[11px] font-semibold text-emerald-700">
                  {formatKb(sizes[url])}
                </figcaption>
              )}
              <button
                type="button"
                aria-label={`Remove image ${i + 1}`}
                disabled={disabled}
                onClick={() => change(latest.current.filter((_, j) => j !== i))}
                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow"
              >
                <X size={14} />
              </button>
            </figure>
          ))}
          {pending.map((p) => (
            <figure key={p.key} className="relative w-24" aria-busy="true">
              <img
                src={p.preview}
                alt="Image being prepared"
                className="h-24 w-24 rounded-xl border object-cover opacity-50"
              />
              <span className="absolute inset-x-0 top-9 flex justify-center">
                <Loader2 size={20} className="animate-spin text-violet-700" />
              </span>
              <figcaption className="mt-1 text-center text-[11px] font-semibold text-slate-500">
                {p.status === "compressing"
                  ? "Compressing..."
                  : `${formatKb(p.size ?? 0)}, uploading...`}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
