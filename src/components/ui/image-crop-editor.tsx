"use client";

import { Minus, Move, Plus } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_IMAGE_CROP, normalizeImageCrop, type ImageCrop } from "@/lib/image-crop";

type ImageCropEditorProps = {
  aspectLabel?: string;
  crop?: ImageCrop | null;
  imageUrl: string;
  onCancel: () => void;
  onSave: (crop: ImageCrop) => void;
  previewClassName?: string;
};

export function ImageCropEditor({
  aspectLabel = "Preview crop",
  crop,
  imageUrl,
  onCancel,
  onSave,
  previewClassName = "aspect-[4/3]"
}: ImageCropEditorProps) {
  const [draft, setDraft] = useState<ImageCrop>(() => normalizeImageCrop(crop));
  const dragRef = useRef<{ x: number; y: number; crop: ImageCrop } | null>(null);

  useEffect(() => {
    setDraft(normalizeImageCrop(crop));
  }, [crop, imageUrl]);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      crop: draft
    };
  }

  function updateDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;
    setDraft({
      ...draft,
      x: clamp(dragRef.current.crop.x + deltaX / 2.4, 0, 100),
      y: clamp(dragRef.current.crop.y + deltaY / 2.4, 0, 100)
    });
  }

  function endDrag() {
    dragRef.current = null;
  }

  function updateZoom(nextZoom: number) {
    setDraft((current) => ({
      ...current,
      zoom: clamp(nextZoom, 1, 3)
    }));
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-[0_28px_90px_rgba(55,34,30,0.22)]">
        <div className="border-b border-border/70 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{aspectLabel}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Position your image</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag to choose the focal point, then zoom until the preview feels right.
          </p>
        </div>

        <div className="p-5">
          <div
            className={`relative mx-auto overflow-hidden rounded-[1.4rem] bg-muted touch-none ${previewClassName}`}
            onPointerDown={beginDrag}
            onPointerMove={updateDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full select-none object-cover"
              draggable={false}
              style={{
                objectPosition: `${draft.x}% ${draft.y}%`,
                transform: `scale(${draft.zoom})`,
                transformOrigin: `${draft.x}% ${draft.y}%`
              }}
            />
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                <Move className="h-3.5 w-3.5" />
                Drag to reposition
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-[1.2rem] bg-[#fbf7f5] p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Zoom</span>
              <span className="text-muted-foreground">{draft.zoom.toFixed(2)}x</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-full bg-white text-muted-foreground"
                onClick={() => updateZoom(draft.zoom - 0.1)}
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={draft.zoom}
                onChange={(event) => updateZoom(Number(event.target.value))}
                className="w-full accent-[#e2a4a7]"
              />
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-full bg-white text-muted-foreground"
                onClick={() => updateZoom(draft.zoom + 0.1)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 px-5 py-4">
          <Button type="button" variant="secondary" onClick={() => setDraft(DEFAULT_IMAGE_CROP)}>
            Reset
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSave(draft)}>
            Save positioning
          </Button>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
