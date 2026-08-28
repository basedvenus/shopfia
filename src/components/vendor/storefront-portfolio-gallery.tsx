"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type StorefrontPortfolioGalleryProps = {
  businessName: string;
  cardClass: string;
  cardStyle: CSSProperties;
  imageRadius: string;
  photos: string[];
};

export function StorefrontPortfolioGallery({
  businessName,
  cardClass,
  cardStyle,
  imageRadius,
  photos
}: StorefrontPortfolioGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activePhoto = activeIndex == null ? null : photos[activeIndex];

  useEffect(() => {
    if (activeIndex == null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") setActiveIndex((current) => previousIndex(current, photos.length));
      if (event.key === "ArrowRight") setActiveIndex((current) => nextIndex(current, photos.length));
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, photos.length]);

  return (
    <>
      <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
        {photos.map((photo, index) => (
          <button
            key={`${photo}-${index}`}
            type="button"
            className={`group relative mb-4 block w-full break-inside-avoid overflow-hidden bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${cardClass}`}
            style={cardStyle}
            onClick={() => setActiveIndex(index)}
          >
            <img
              src={photo}
              alt={`${businessName} portfolio photo ${index + 1}`}
              className="h-auto w-full transition duration-500 group-hover:scale-[1.015]"
            />
            <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#2f2626] opacity-0 shadow-sm transition group-hover:opacity-100">
              View photo
            </span>
          </button>
        ))}
      </div>

      {activePhoto ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#1e1715]/88 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Portfolio photo viewer">
          <button
            type="button"
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white text-[#2f2626] shadow-lg"
            onClick={() => setActiveIndex(null)}
            aria-label="Close portfolio photo"
          >
            <X className="h-5 w-5" />
          </button>

          {photos.length > 1 ? (
            <button
              type="button"
              className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-[#2f2626] shadow-lg sm:grid"
              onClick={() => setActiveIndex((current) => previousIndex(current, photos.length))}
              aria-label="Previous portfolio photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}

          <div className={`grid max-h-[82vh] w-full max-w-5xl place-items-center overflow-hidden bg-white ${imageRadius}`}>
            <img
              src={activePhoto}
              alt={`${businessName} portfolio photo ${(activeIndex ?? 0) + 1} enlarged`}
              className="max-h-[82vh] w-auto max-w-full object-contain p-3"
            />
          </div>

          {photos.length > 1 ? (
            <button
              type="button"
              className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-[#2f2626] shadow-lg sm:grid"
              onClick={() => setActiveIndex((current) => nextIndex(current, photos.length))}
              aria-label="Next portfolio photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function previousIndex(current: number | null, length: number) {
  if (current == null || length === 0) return null;
  return (current - 1 + length) % length;
}

function nextIndex(current: number | null, length: number) {
  if (current == null || length === 0) return null;
  return (current + 1) % length;
}
