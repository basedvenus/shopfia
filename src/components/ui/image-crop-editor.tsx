"use client";

import { Loader2, Minus, Move, Plus } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_IMAGE_CROP, MAX_IMAGE_ZOOM, MIN_IMAGE_ZOOM, normalizeImageCrop, imageCropToCss, type ImageCrop } from "@/lib/image-crop";

type ImageCropEditorProps = {
  aspectLabel?: string;
  allowAdjustments?: boolean;
  crop?: ImageCrop | null;
  imageUrl: string;
  onCancel: () => void;
  onSave: (crop: ImageCrop) => void;
  previewClassName?: string;
  previewAspectRatio?: number;
};

export function ImageCropEditor({
  aspectLabel = "Preview crop",
  allowAdjustments = false,
  crop,
  imageUrl,
  onCancel,
  onSave,
  previewClassName = "aspect-[4/3]",
  previewAspectRatio
}: ImageCropEditorProps) {
  const [draft, setDraft] = useState<ImageCrop>(() => normalizeImageCrop(crop));
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const dragRef = useRef<{ x: number; y: number; crop: ImageCrop } | null>(null);

  useEffect(() => {
    setDraft(normalizeImageCrop(crop));
  }, [crop, imageUrl]);

  useEffect(() => { setImageLoaded(false); setImageFailed(false); }, [imageUrl]);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (!imageLoaded) return;
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
      x: clamp(dragRef.current.crop.x - deltaX / 2.4, 0, 100),
      y: clamp(dragRef.current.crop.y - deltaY / 2.4, 0, 100)
    });
  }

  function endDrag() {
    dragRef.current = null;
  }

  function updateZoom(nextZoom: number) {
    setDraft((current) => ({
      ...current,
      zoom: clamp(nextZoom, MIN_IMAGE_ZOOM, MAX_IMAGE_ZOOM)
    }));
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-white/70 bg-white shadow-[0_28px_90px_rgba(55,34,30,0.22)]">
        <div className="border-b border-border/70 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{aspectLabel}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Edit your photo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag the photo to reposition it, then adjust the preview until it feels right.
          </p>
        </div>

        <div className="p-5">
          <div
            className={`relative mx-auto overflow-hidden rounded-[1.4rem] bg-muted touch-none ${previewClassName}`}
            style={previewAspectRatio ? { aspectRatio: previewAspectRatio } : undefined}
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
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
              style={imageCropToCss(draft)}
            />
            {!imageLoaded ? <div role="status" className="absolute inset-0 grid place-items-center bg-muted">
              {imageFailed ? <span className="text-sm">Could not load this photo. Close and try again.</span> : <span className="flex items-center gap-2 text-sm"><Loader2 className="h-5 w-5 animate-spin" /> Loading your photo...</span>}
            </div> : null}
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
                aria-label="Zoom"
                type="range"
                min={MIN_IMAGE_ZOOM}
                max={MAX_IMAGE_ZOOM}
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
          {allowAdjustments ? (
            <div className="mt-4 grid gap-4 rounded-[1.2rem] bg-[#fbf7f5] p-4">
              <label className="grid gap-2 text-sm font-medium">
                <span className="flex justify-between">Brightness <span className="font-normal text-muted-foreground">{Math.round((draft.brightness ?? 1) * 100)}%</span></span>
                <input type="range" min="0.5" max="1.5" step="0.01" value={draft.brightness ?? 1} onChange={(event) => setDraft((current) => ({ ...current, brightness: Number(event.target.value) }))} className="w-full accent-[#a83264]" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span className="flex justify-between">Saturation <span className="font-normal text-muted-foreground">{Math.round((draft.saturation ?? 1) * 100)}%</span></span>
                <input type="range" min="0" max="2" step="0.01" value={draft.saturation ?? 1} onChange={(event) => setDraft((current) => ({ ...current, saturation: Number(event.target.value) }))} className="w-full accent-[#a83264]" />
              </label>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 px-5 py-4">
          <Button type="button" variant="secondary" onClick={() => setDraft(DEFAULT_IMAGE_CROP)}>
            Reset
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={!imageLoaded || imageFailed} onClick={() => onSave(draft)}>
            Save photo edits
          </Button>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
