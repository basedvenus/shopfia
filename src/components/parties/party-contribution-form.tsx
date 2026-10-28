"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPartyContributionAction, reviewPartyContributionAction } from "@/app/actions/party-contributions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Music2, Plus, Upload, Video, X } from "lucide-react";
import { PartyMedia } from "@/components/parties/party-media";

type GuestPhoto = { id: string; file: File; url: string; photoId?: string };
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function PartyContributionForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const previews = useRef(new Set<string>());
  const [kind, setKind] = useState("PHOTO");
  const [photos, setPhotos] = useState<GuestPhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const selected = photos.find((photo) => photo.id === selectedId) ?? photos[0];
  useEffect(() => {
    const urls = previews.current;
    return () => { for (const value of urls) URL.revokeObjectURL(value); urls.clear(); };
  }, []);
  function addPhotos(files: FileList | File[]) {
    const accepted = Array.from(files).filter((file) => PHOTO_TYPES.has(file.type) && file.size > 0 && file.size <= 10 * 1024 * 1024);
    const remaining = Math.max(0, 8 - photos.length);
    const additions = accepted.slice(0, remaining).map((file) => {
      const preview = URL.createObjectURL(file); previews.current.add(preview);
      return { id: crypto.randomUUID(), file, url: preview };
    });
    setPhotos((current) => [...current, ...additions].slice(0, 8));
    if (additions.length && !selectedId) setSelectedId(additions[0].id);
    setMessage(accepted.length !== files.length ? "Choose JPEG, PNG, WebP, or GIF photos up to 10 MB each." : accepted.length > remaining ? "Add up to 8 photos per submission." : "");
  }
  function removePhoto(photo: GuestPhoto) {
    URL.revokeObjectURL(photo.url); previews.current.delete(photo.url);
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
  }
  return <form className="grid min-w-0 gap-4" action={() => {
    setMessage("");
    if (kind === "PHOTO" && !photos.length) { setMessage("Choose a photo first."); return; }
    startTransition(async () => {
      let sent = 0;
      try {
        const items = kind === "PHOTO" ? photos : [null];
        for (const photo of items) {
          const form = new FormData(); form.set("eventId", eventId); form.set("kind", kind);
          if (photo) {
            let photoId = photo.photoId;
            if (!photoId) {
              const upload = new FormData(); upload.set("file", photo.file);
              const response = await fetch("/api/uploads/party-photo", { method: "POST", body: upload });
              const body = await response.json();
              if (!response.ok || !body.photo?.id) throw new Error(body.error ?? "Could not upload this photo.");
              photoId = body.photo.id;
              setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, photoId } : item));
            }
            form.set("photoId", photoId!);
          } else form.set("url", url);
          const result = await submitPartyContributionAction(form);
          if (!result.ok) throw new Error(result.error ?? "Could not submit this item.");
          sent++;
          if (photo) removePhoto(photo);
        }
        if (kind !== "PHOTO") setUrl("");
        setMessage(`${sent > 1 ? `${sent} photos sent` : "Sent"} to the host for approval. Only you and the host can see submissions until approved.`);
        router.refresh();
      } catch (error) {
        setMessage(`${sent ? `${sent} sent successfully. ` : ""}${error instanceof Error ? error.message : "Could not submit. Please try again."} Your unsent items are still here.`);
        if (sent) router.refresh();
      }
    });
  }}>
    <div className="flex flex-wrap gap-2" aria-label="Memory type">
      {([{value:"PHOTO",label:"Photos",icon:ImagePlus},{value:"TIKTOK",label:"Video link",icon:Video},{value:"PLAYLIST",label:"Playlist",icon:Music2}]).map(({value,label,icon:Icon}) => <Button key={value} type="button" variant={kind === value ? "default" : "secondary"} aria-pressed={kind === value} disabled={pending} onClick={() => { setKind(value); setMessage(""); setUrl(""); }}><Icon className="h-4 w-4" />{label}</Button>)}
    </div>
    {kind === "PHOTO" ? <div className="grid min-w-0 gap-4">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={pending} className="sr-only" aria-label="Choose guest party photos" onChange={(event) => { if (event.target.files) addPhotos(event.target.files); event.target.value = ""; }} />
      <button type="button" disabled={pending} onClick={() => input.current?.click()} onDragOver={(event) => { event.preventDefault(); if (!pending) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!pending) addPhotos(event.dataTransfer.files); }} className={`relative grid aspect-[16/10] w-full min-w-0 max-w-2xl place-content-center overflow-hidden rounded-3xl border-2 bg-muted text-center transition ${dragging ? "border-primary ring-4 ring-primary/20" : "border-border"}`} aria-label="Add guest photos by dropping files or choosing photos">
        {selected ? <img src={selected.url} alt={`Preview of ${selected.file.name}`} className="absolute inset-0 h-full w-full object-contain" /> : <span className="grid gap-3 p-5"><Upload className="mx-auto h-10 w-10 text-primary" /><span className="text-xl font-semibold">Drag your photos here</span><span className="text-sm text-muted-foreground">Or click to choose photos</span></span>}
      </button>
      <div className="grid max-w-2xl grid-cols-3 gap-3 sm:grid-cols-4">
        {photos.map((photo) => <div key={photo.id} className={`relative aspect-square overflow-hidden rounded-2xl border-2 ${selected?.id === photo.id ? "border-primary" : "border-transparent"}`}><button type="button" disabled={pending} className="h-full w-full" onClick={() => setSelectedId(photo.id)} aria-label={`Preview ${photo.file.name}`} aria-pressed={selected?.id === photo.id}><img src={photo.url} alt={photo.file.name} className="h-full w-full object-cover" /></button><button type="button" disabled={pending} onClick={() => removePhoto(photo)} aria-label={`Remove ${photo.file.name}`} className="absolute right-1 top-1 rounded-full bg-white p-1.5 shadow-sm"><X className="h-4 w-4" /></button></div>)}
        <button type="button" disabled={pending || photos.length >= 8} onClick={() => input.current?.click()} className="grid aspect-square place-content-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 text-primary disabled:opacity-50"><Plus className="mx-auto h-10 w-10" /><span className="text-sm font-semibold">Add photos</span></button>
      </div>
      <p className="text-xs text-muted-foreground">Up to 8 photos at a time. JPEG, PNG, WebP, or GIF, up to 10 MB each. Select a thumbnail to preview it.</p>
    </div> : <div className="grid min-w-0 max-w-2xl gap-3">
      <label className="grid gap-2 text-sm font-medium">{kind === "TIKTOK" ? "TikTok video link" : "Public Apple Music or Spotify playlist link"}<Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={2048} required disabled={pending} placeholder={kind === "TIKTOK" ? "https://www.tiktok.com/@you/video/…" : "Paste your playlist link"} /></label>
      <PartyMedia tiktokUrl={kind === "TIKTOK" ? url : null} appleMusicUrl={kind === "PLAYLIST" ? url : null} spotifyUrl={kind === "PLAYLIST" ? url : null} />
    </div>}
    <Button type="submit" className="w-fit" disabled={pending}>{pending ? "Sending…" : "Send to host for approval"}</Button>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </form>;
}

export function ContributionReviewControls({ contributionId }: { contributionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return <form className="mt-3 flex flex-wrap gap-2" action={(form) => {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await reviewPartyContributionAction(form);
        if (!result.ok) setMessage(result.error ?? "Could not review this item.");
        else router.refresh();
      } catch { setMessage("Could not review this item. Please try again."); }
    });
  }}>
    <input type="hidden" name="contributionId" value={contributionId} />
    <Button name="decision" value="APPROVED" type="submit" disabled={pending}>Approve</Button>
    <Button name="decision" value="REJECTED" type="submit" variant="secondary" disabled={pending}>Decline</Button>
    {message ? <p role="alert" className="w-full text-sm text-destructive">{message}</p> : null}
  </form>;
}
