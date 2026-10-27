"use client";
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X, Expand, Pause, Play } from "lucide-react";
import { CroppedImage } from "@/components/ui/cropped-image";
import { type ImageCrop } from "@/lib/image-crop";

type Photo = { id: string; url: string; fullUrl: string; crop: ImageCrop; vendorAnchors: string[] };
export function PartyPhotoGallery({ title, photos }: { title: string; photos: Photo[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [slide, setSlide] = useState(photos.length > 1 ? 1 : 0);
  const [playing, setPlaying] = useState(false);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPlaying(!preference.matches);
    const update = () => setPlaying(!preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!playing || interacting || active !== null || photos.length < 2) return;
    const timer = window.setInterval(() => { if (!document.hidden) setSlide((index) => (index + 1) % photos.length); }, 5000);
    return () => window.clearInterval(timer);
  }, [playing, interacting, active, photos.length]);
  const featuredIndex = slide % Math.max(1, photos.length);
  const featured = photos[featuredIndex];
  const [failed, setFailed] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const current = active === null ? null : photos[active];
  function move(delta: number) { setFailed(null); setActive((index) => index === null ? null : (index + delta + photos.length) % photos.length); }
  return <Dialog.Root open={active !== null} onOpenChange={(open) => { if (!open) setActive(null); }}>
    <div id="party-gallery" className="grid scroll-mt-24 grid-cols-2 gap-3 md:grid-cols-4">
      {!photos.length ? <p className="col-span-full rounded-2xl bg-muted/60 p-5 text-sm text-muted-foreground">No party photos have been added yet.</p> : null}
      {featured && photos.length > 1 ? <div className="relative col-span-2 row-span-2 aspect-[4/3] self-start overflow-hidden rounded-[1.4rem] border border-white/80 bg-muted shadow-sm" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocusCapture={() => setInteracting(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}>
        <Dialog.Trigger asChild><button type="button" aria-label={`Enlarge slideshow photo ${featuredIndex + 1}`} className="absolute inset-0 h-full w-full focus-visible:ring-2 focus-visible:ring-primary" onClick={(event) => { opener.current = event.currentTarget; setFailed(null); setActive(featuredIndex); }}>
          <CroppedImage src={featured.url} alt={`${title} slideshow photo ${featuredIndex + 1}`} crop={featured.crop} frameFit="contain" className="absolute inset-0 h-full w-full" loading="eager" />
        </button></Dialog.Trigger>
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 text-white">
          <button type="button" aria-label="Previous slideshow photo" className="grid h-10 w-10 place-items-center rounded-full bg-black/60" onClick={() => setSlide((index) => (index - 1 + photos.length) % photos.length)}><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" aria-label={playing ? "Pause slideshow" : "Play slideshow"} className="grid h-10 w-10 place-items-center rounded-full bg-black/60" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause aria-hidden="true" className="h-5 w-5" /> : <Play aria-hidden="true" className="h-5 w-5" />}</button>
          <button type="button" aria-label="Next slideshow photo" className="grid h-10 w-10 place-items-center rounded-full bg-black/60" onClick={() => setSlide((index) => (index + 1) % photos.length)}><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div> : null}
      {photos.map((photo, index) => <Dialog.Trigger key={photo.id} asChild><button type="button" aria-label={`Enlarge ${title} photo ${index + 1}`} onClick={(event) => { opener.current = event.currentTarget; setFailed(null); setActive(index); }} style={{ aspectRatio: photo.crop.aspectRatio ?? 4 / 3 }} className={`group relative self-start overflow-hidden rounded-[1.4rem] border border-white/80 bg-muted shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary `}>
        <CroppedImage src={photo.url} alt={`${title} party photo ${index + 1}`} crop={photo.crop} frameFit="contain" className="absolute inset-0 h-full w-full object-cover" loading={index === 0 ? "eager" : "lazy"} />
        <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white"><Expand className="h-4 w-4" /></span>
        {photo.vendorAnchors.map((id) => <span key={id} id={id} className="pointer-events-none absolute inset-1 rounded-[1.2rem] transition target:ring-4 target:ring-primary/45 target:ring-offset-2 target:ring-offset-background" aria-hidden="true" />)}
      </button></Dialog.Trigger>)}
    </div>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm" />
      <Dialog.Content aria-describedby="party-viewer-description" className="fixed inset-3 z-[91] flex flex-col gap-3 text-white outline-none sm:inset-6" onCloseAutoFocus={(event) => { event.preventDefault(); opener.current?.focus(); }} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); } if (event.key === "ArrowRight") { event.preventDefault(); move(1); } }}>
        <div className="flex items-center justify-between gap-3 pr-12"><Dialog.Title className="truncate text-base font-semibold">{title}</Dialog.Title><p aria-live="polite" className="shrink-0 text-sm">Photo {(active ?? 0) + 1} of {photos.length}</p></div>
        <Dialog.Description id="party-viewer-description" className="sr-only">Full photo viewer. Use previous and next buttons, arrow keys, or swipe to browse. Press Escape to close.</Dialog.Description>
        <Dialog.Close aria-label="Close photo viewer" className="absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-full bg-white/15 hover:bg-white/25"><X className="h-5 w-5" /></Dialog.Close>
        <div className="relative grid min-h-0 flex-1 place-items-center" style={{ touchAction: "pan-y pinch-zoom" }} onTouchStart={(event) => { touch.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }} onTouchEnd={(event) => { if (!touch.current || !event.changedTouches.length) return; const dx = event.changedTouches[0].clientX - touch.current.x; const dy = event.changedTouches[0].clientY - touch.current.y; touch.current = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2 && photos.length > 1) move(dx < 0 ? 1 : -1); }}>
          {current ? <img key={current.id} src={current.fullUrl} alt={`${title} photo ${(active ?? 0) + 1}, saved crop`} className="absolute inset-0 h-full w-full object-contain" onError={() => setFailed(current.id)} /> : null}
          {current && failed === current.id ? <p role="alert" className="absolute rounded-xl bg-black/80 p-4">Could not load this photo. Try opening the photo below.</p> : null}
        </div>
        <div className="flex items-center justify-center gap-4 pb-[env(safe-area-inset-bottom)]">
          {photos.length > 1 ? <button type="button" aria-label="Previous photo" onClick={() => move(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-white/15 hover:bg-white/25"><ChevronLeft /></button> : null}
          {current ? <a href={current.fullUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/30 px-5 py-2 text-sm underline-offset-4 hover:underline">Open photo</a> : null}
          {photos.length > 1 ? <button type="button" aria-label="Next photo" onClick={() => move(1)} className="grid h-11 w-11 place-items-center rounded-full bg-white/15 hover:bg-white/25"><ChevronRight /></button> : null}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
