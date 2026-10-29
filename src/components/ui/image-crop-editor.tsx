"use client";

import { Loader2, Minus, Move, Plus } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_IMAGE_CROP, MAX_IMAGE_ZOOM, MIN_IMAGE_ZOOM, normalizeImageCrop, cropImageRect, fitImageZoom, type ImageCrop } from "@/lib/image-crop";

type ImageCropEditorProps = {
  aspectLabel?: string;
  allowAdjustments?: boolean;
  crop?: ImageCrop | null;
  imageUrl: string;
  minZoom?: number;
  preserveFrame?: boolean;
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
  preserveFrame = false,
  minZoom = MIN_IMAGE_ZOOM,
  onCancel,
  onSave,
  previewClassName = "aspect-[4/3]",
  previewAspectRatio
}: ImageCropEditorProps) {
  const [draft, setDraft] = useState<ImageCrop>(() => ({ ...normalizeImageCrop(crop), zoom: Math.max(minZoom, normalizeImageCrop(crop).zoom) }));
  const [dimensions,setDimensions]=useState({width:0,height:0,frameWidth:0,frameHeight:0});
  const fitZoom=dimensions.width && dimensions.frameWidth ? fitImageZoom(dimensions.width,dimensions.height,dimensions.frameWidth,dimensions.frameHeight) : minZoom;
  const effectiveMin=Math.max(minZoom,fitZoom);
  const rect=dimensions.width && dimensions.frameWidth ? cropImageRect(dimensions.width,dimensions.height,dimensions.frameWidth,dimensions.frameHeight,{...draft,zoom:Math.max(effectiveMin,draft.zoom)}) : null;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; crop: ImageCrop } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    setDraft(({ ...normalizeImageCrop(crop), zoom: Math.max(minZoom, normalizeImageCrop(crop).zoom) }));
    pointers.current.clear();
    pinchRef.current = null;
    dragRef.current = null;
  }, [crop, imageUrl, minZoom]);

  useEffect(() => { setImageLoaded(false); setImageFailed(false); }, [imageUrl]);

  useEffect(()=>{const node=previewRef.current;if(!node)return;const measure=()=>{const bounds=node.getBoundingClientRect();setDimensions(value=>({...value,frameWidth:bounds.width,frameHeight:bounds.height}));};measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[]);
  useEffect(()=>{setDraft(value=>({...value,zoom:Math.max(effectiveMin,value.zoom)}));},[effectiveMin]);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (!imageLoaded) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = { distance: Math.hypot(b.x - a.x, b.y - a.y), zoom: draft.zoom };
    }
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      crop: draft
    };
  }

  function updateDrag(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()];
      if (pinchRef.current.distance > 0) updateZoom(pinchRef.current.zoom * Math.hypot(b.x - a.x, b.y - a.y) / pinchRef.current.distance);
      return;
    }
    if (!dragRef.current) return;
    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;
    const { width, height } = event.currentTarget.getBoundingClientRect();
    const image = imageRef.current;
    if (!image?.naturalWidth || !width || !height) return;
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const zoom = dragRef.current.crop.zoom;
    const overflowX = image.naturalWidth * scale * zoom - width;
    const overflowY = image.naturalHeight * scale * zoom - height;
    setDraft({
      ...draft,
      x: overflowX > 0 ? clamp(dragRef.current.crop.x - deltaX / overflowX * 100, 0, 100) : dragRef.current.crop.x,
      y: overflowY > 0 ? clamp(dragRef.current.crop.y - deltaY / overflowY * 100, 0, 100) : dragRef.current.crop.y
    });
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    pinchRef.current = null;
    const remaining = [...pointers.current.values()][0];
    if (remaining) {
      dragRef.current = { ...remaining, crop: draft };
      return;
    }
    dragRef.current = null;
  }

  function updateZoom(nextZoom: number) {
    setDraft((current) => ({
      ...current,
      zoom: clamp(nextZoom, effectiveMin, MAX_IMAGE_ZOOM)
    }));
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-white/70 bg-white shadow-[0_28px_90px_rgba(55,34,30,0.22)]">
        <div className="border-b border-border/70 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{aspectLabel}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Edit your photo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag to reposition or pinch with two fingers to zoom.
          </p>
        </div>

        <div className="p-5">
          <div
            ref={previewRef}
            className={`relative mx-auto overflow-hidden rounded-[1.4rem] bg-muted touch-none ${previewClassName}`}
            style={previewAspectRatio ? { aspectRatio: previewAspectRatio } : undefined}
            onPointerDown={beginDrag}
            onPointerMove={updateDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt=""
              className="absolute select-none"
              draggable={false}
              onLoad={event => {const {naturalWidth:width,naturalHeight:height}=event.currentTarget;setImageLoaded(true);setDimensions(value=>({...value,width,height}));}}
              onError={() => setImageFailed(true)}
              style={{width:rect?.width??"100%",height:rect?.height??"100%",left:rect?.x??0,top:rect?.y??0,maxWidth:"none",filter:`brightness(${draft.brightness??1}) saturate(${draft.saturation??1})`}}
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
              {effectiveMin<1 && <button type="button" className="text-xs underline" onClick={()=>setDraft(current=>({...current,x:50,y:50,zoom:effectiveMin}))}>Fit whole photo</button>}
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
                min={effectiveMin}
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
          <Button type="button" variant="secondary" onClick={() => setDraft({ ...DEFAULT_IMAGE_CROP, zoom: Math.max(minZoom, DEFAULT_IMAGE_CROP.zoom) })}>
            Reset
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={!imageLoaded || imageFailed} onClick={() => {
            const frame = previewRef.current?.getBoundingClientRect();
            onSave(preserveFrame && frame?.height ? { ...draft, aspectRatio: frame.width / frame.height } : draft);
          }}>
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
