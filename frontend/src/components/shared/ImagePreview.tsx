"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useEscapeKey } from "@/lib/useEscapeKey";

export const productImages = (p: any): string[] =>
  (Array.isArray(p?.images) ? p.images : [])
    .map((img: any) => (typeof img === "string" ? img : img?.url))
    .filter(Boolean);

/** Clickable thumbnail that opens a full-screen viewer (arrows for multiple images). */
export default function ImagePreview({
  product,
  className = "h-11 w-11",
  rounded = "rounded-xl",
}: {
  product: any;
  className?: string;
  rounded?: string;
}) {
  const images = productImages(product);
  const [index, setIndex] = useState<number | null>(null);
  useEscapeKey(() => setIndex(null), index !== null);
  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight")
        setIndex((i) => (i === null ? null : (i + 1) % images.length));
      if (event.key === "ArrowLeft")
        setIndex((i) =>
          i === null ? null : (i - 1 + images.length) % images.length,
        );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, images.length]);
  if (!images.length)
    return (
      <span
        className={`${className} inline-flex items-center justify-center ${rounded} bg-slate-100 text-xs text-slate-400`}
      >
        N/A
      </span>
    );
  return (
    <>
      <button
        type="button"
        title="Preview product image"
        aria-label={`Preview ${product?.itemName || "product"} image`}
        onClick={(e) => {
          e.stopPropagation();
          setIndex(0);
        }}
        className={`${rounded} shrink-0 focus-visible:outline-2 focus-visible:outline-violet-600`}
      >
        <img
          src={images[0]}
          alt={product?.itemName || "Product"}
          className={`${className} ${rounded} border-2 border-white object-cover hover:ring-2 hover:ring-violet-400`}
        />
      </button>
      {index !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200000] flex items-center justify-center bg-slate-950/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Product image preview"
            onClick={() => setIndex(null)}
          >
            <button
              type="button"
              onClick={() => setIndex(null)}
              aria-label="Close image preview"
              className="absolute right-5 top-5 rounded-full bg-white/15 p-3 text-white hover:bg-white/25"
            >
              <X size={23} />
            </button>
            {images.length > 1 && (
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((index - 1 + images.length) % images.length);
                }}
                className="absolute left-3 rounded-full bg-white/20 p-3 text-white"
              >
                <ChevronLeft />
              </button>
            )}
            <img
              src={images[index]}
              alt={product?.itemName || "Product"}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[82vh] max-w-[85vw] rounded-xl object-contain"
            />
            {images.length > 1 && (
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((index + 1) % images.length);
                }}
                className="absolute right-3 rounded-full bg-white/20 p-3 text-white"
              >
                <ChevronRight />
              </button>
            )}
            <div className="absolute bottom-5 text-center text-sm text-white">
              {product?.itemName || "Product"}
              {images.length > 1 ? ` · ${index + 1} / ${images.length}` : ""}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
