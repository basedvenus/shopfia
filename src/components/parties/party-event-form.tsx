"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { SlidersHorizontal, Trash2, Loader2, Plus, Search, Star, Upload, X, Tag } from "lucide-react";
import { createPartyEventAction, updatePartyEventAction, followPartyVendorAction } from "@/app/actions/auth";
import { createUnclaimedVendorAction } from "@/app/actions/vendor";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";
import { Button } from "@/components/ui/button";
import { CroppedImage } from "@/components/ui/cropped-image";
import { CountySelector } from "@/components/parties/county-selector";
import { PartyMedia } from "@/components/parties/party-media";
import { getAppleMusicPlaylist, getTikTokVideo, isTikTokShareUrl, getSpotifyPlaylist } from "@/lib/party-media";
import { ImageCropEditor } from "@/components/ui/image-crop-editor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_IMAGE_CROP, normalizePartyPhotoCrop, type ImageCrop } from "@/lib/image-crop";
import { getSafeProfileImage } from "@/lib/profile-image";

import { PARTY_OCCASIONS, occasionTag, inferPartyOccasion } from "@/lib/party-occasions";

const MAX_PARTY_UPLOAD_BYTES = 3.5 * 1024 * 1024;
const MAX_PARTY_UPLOAD_DIMENSION = 2400;
const SUPPORTED_PARTY_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type VendorOption = {
  id: string;
  name: string;
  username: string | null;
  city: string;
  state: string | null;
  logoUrl: string | null;
  status?: "CLAIMED" | "UNCLAIMED" | "VERIFIED";
};

type UserOption = {
  id: string;
  image: string | null;
  name: string | null;
  username: string | null;
};

type UploadedPartyPhoto = {
  crop: ImageCrop;
  id: string;
  url: string;
  vendorIds: string[];
  vendorContributions: Record<string, string>;
  vendorRatings?: Record<string, number>;
};

export type EditablePartyEvent = {
  id: string;
  slug: string;
  title: string;
  theme: string | null;
  tags: string[];
  description: string | null;
  eventDate?: Date | string | null;
  partyfulUrl?: string | null;
  tiktokUrl?: string | null;
  tiktokUrls?: string[];
  spotifyUrl?: string | null;
  pinterestUrl?: string | null;
  county?: string | null;
  countyFips?: string | null;
  appleMusicUrl?: string | null;
  location: string | null;
  formattedAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  googlePlaceId?: string | null;
  mainHostId?: string | null;
  coHostIds?: string[];
  guestIds?: string[];
  photos: UploadedPartyPhoto[];
};

type PartyEventFormProps = {
  currentUserId: string;
  composer?: boolean;
  initialParty?: EditablePartyEvent | null;
  users: UserOption[];
  vendors: VendorOption[];
};

export function PartyEventForm({ currentUserId, composer = false, initialParty, users, vendors }: PartyEventFormProps) {
  const isEditing = Boolean(initialParty);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(initialParty?.photos[0]?.id ?? null);
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occasion, setOccasion] = useState(() => inferPartyOccasion(initialParty?.tags ?? [], initialParty?.title ?? ""));
  const [privateResidence, setPrivateResidence] = useState(initialParty?.location === "Private residence");
  const [photos, setPhotos] = useState<UploadedPartyPhoto[]>(() =>
    (initialParty?.photos ?? []).map((photo) => ({
      ...photo,
      crop: { ...normalizePartyPhotoCrop(photo.crop), zoom: Math.max(1, photo.crop.zoom) },
      vendorContributions: photo.vendorContributions ?? {}
    }))
  );
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>(vendors);
  const [mainHostId, setMainHostId] = useState(initialParty?.mainHostId ?? currentUserId);
  const [tiktokUrls, setTikTokUrls] = useState<string[]>(() => initialParty?.tiktokUrls?.length ? initialParty.tiktokUrls : [initialParty?.tiktokUrl ?? ""]);
  const [spotifyUrl, setSpotifyUrl] = useState(initialParty?.spotifyUrl ?? "");
  const [appleMusicUrl, setAppleMusicUrl] = useState(initialParty?.appleMusicUrl ?? "");
  const [guestIds, setGuestIds] = useState<string[]>(() => initialParty?.guestIds ?? []);
  const [coHostIds, setCoHostIds] = useState<string[]>(() => initialParty?.coHostIds ?? []);
  const [editingCropPhoto, setEditingCropPhoto] = useState<UploadedPartyPhoto | null>(null);
  const [newVendorModal, setNewVendorModal] = useState<{ initialName: string; photoId: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const uploadAsCoverRef = useRef(false);
  const [editingCover, setEditingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(fileList: FileList | File[]) {
    const asCover = uploadAsCoverRef.current;
    uploadAsCoverRef.current = false;
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/")).slice(0, 16 - photos.length);
    if (!files.length) {
      setMessage("Choose photo files to upload. Videos are not supported yet.");
      return;
    }

    setMessage(null);
    setIsUploading(true);
    try {
      const uploaded: UploadedPartyPhoto[] = [];
      for (const file of files) {
        uploaded.push(await uploadPartyPhoto(file));
      }
      setPhotos((current) => [...current, ...uploaded].slice(0, 16));
      setEditingCover(asCover);
      setEditingCropPhoto(uploaded[0] ?? null);
      if (asCover) setCoverPickerOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload one of those photos.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function togglePhotoVendor(photoId: string, vendorId: string, forceSelected?: boolean) {
    setPhotos((current) =>
      current.map((photo) => {
        if (photo.id !== photoId) return photo;
        const hasVendor = photo.vendorIds.includes(vendorId);
        const shouldSelect = forceSelected ?? !hasVendor;
        const vendorContributions = { ...photo.vendorContributions };
        if (!shouldSelect) {
          delete vendorContributions[vendorId];
        }
        return {
          ...photo,
          vendorIds: shouldSelect
            ? hasVendor
              ? photo.vendorIds
              : [...photo.vendorIds, vendorId].slice(0, 8)
            : photo.vendorIds.filter((id) => id !== vendorId),
          vendorContributions
        };
      })
    );
  }

  function addCreatedVendor(photoId: string, vendor: VendorOption) {
    setVendorOptions((current) => {
      if (current.some((option) => option.id === vendor.id)) return current;
      return [...current, vendor].sort((a, b) => a.name.localeCompare(b.name));
    });
    togglePhotoVendor(photoId, vendor.id, true);
  }

  function setPhotoVendorContribution(photoId: string, vendorId: string, contribution: string) {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              vendorContributions: {
                ...photo.vendorContributions,
                [vendorId]: contribution
              }
            }
          : photo
      )
    );
  }

  function setPhotoCrop(photoId: string, crop: ImageCrop) {
    setPhotos((current) =>
      current.map((photo) => (photo.id === photoId ? { ...photo, crop } : photo))
    );
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => current.filter((photo) => photo.id !== photoId));
    void fetch(`/api/party-photos/${photoId}`, { method: "DELETE" });
  }

  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId) ?? photos[0];
  function goToVendors() {
    if (!formRef.current?.reportValidity()) return;
    if (!photos.length) { setMessage("Add at least one photo first."); return; }
    setMessage(null);
    setSelectedPhotoId((current) => current ?? photos[0].id);
    setStep(2);
  }

  function setCoverPhoto(photoId: string) {
    setPhotos((current) => {
      const index = current.findIndex((photo) => photo.id === photoId);
      if (index <= 0) return current;
      const next = [...current];
      const [photo] = next.splice(index, 1);
      return [photo, ...next];
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => { if (!isEditing && step === 1) { event.preventDefault(); goToVendors(); } }}
      action={(formData) => {
        setMessage(null);
        const missingRatingPhoto = photos.find((photo) => photo.vendorIds.some((id) => !photo.vendorRatings?.[id]));
        if (missingRatingPhoto) {
          setSelectedPhotoId(missingRatingPhoto.id);
          setStep(2);
          setMessage("Rate each tagged vendor before saving your party.");
          return;
        }
        if (initialParty) {
          formData.set("eventId", initialParty.id);
        }
        if (occasion) formData.append("tags", occasionTag(occasion));
        formData.set("mainHostId", mainHostId);
        guestIds.forEach((id) => formData.append("guestIds", id));
        coHostIds.forEach((id) => formData.append("coHostIds", id));
        formData.set(
          "photos",
          JSON.stringify(photos.map(({ crop, id, vendorContributions, vendorIds, vendorRatings }) => ({ crop, id, vendorContributions, vendorIds, vendorRatings })))
        );

        startTransition(async () => {
          try {
            const result = initialParty
              ? await updatePartyEventAction(formData)
              : await createPartyEventAction(formData);
            if (!result.ok) {
              setMessage(result.error ?? "Could not save party.");
              return;
            }
            window.location.href = `/events/${result.eventSlug}`;
          } catch {
            setMessage("Your changes could not be saved. Please try again; your edits are still here.");
          }
        });
      }}
      className="grid min-w-0 gap-5"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => event.preventDefault()}
    >
      {!isEditing ? <nav aria-label="Party creation steps" className="mb-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => setStep(1)} aria-current={step === 1 ? "step" : undefined} className={`rounded-full px-5 py-3 text-sm font-semibold ${step === 1 ? "party-brand-button text-white" : "bg-muted"}`}>1. Party details</button>
        <button type="button" onClick={goToVendors} aria-current={step === 2 ? "step" : undefined} className={`rounded-full px-5 py-3 text-sm font-semibold ${step === 2 ? "party-brand-button text-white" : "bg-muted"}`}>2. Tag vendors</button>
      </nav> : null}
      <div className={(composer || isEditing) ? "grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-8" : "grid min-w-0 gap-5"}>
        <div className={(composer || isEditing) ? "min-w-0" : "order-2"}>
      <div className="flex min-w-0 flex-col gap-4">
        <input ref={fileInputRef} type="file" accept="image/*" multiple disabled={isUploading} className="sr-only" onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); }} />
        <div onDragEnter={(event) => { event.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
          onDrop={(event) => {
            event.preventDefault(); event.stopPropagation(); setIsDragOver(false);
            const id = event.dataTransfer.getData("application/x-shopfia-photo");
            if (id && photos.some((photo) => photo.id === id)) setCoverPhoto(id);
            else if (!isUploading && event.dataTransfer.files.length) { uploadAsCoverRef.current = true; void uploadFiles(event.dataTransfer.files); }
          }}
          className={`overflow-hidden rounded-3xl border-2 transition ${isDragOver ? "border-primary ring-4 ring-primary/20" : "border-border"}`}>
          <button type="button" onClick={() => { if (photos[0]) { setCoverPickerOpen(true); } else { uploadAsCoverRef.current = true; fileInputRef.current?.click(); } }}
            aria-label={photos[0] ? "Select your cover photo" : "Upload your party photos"} className="relative block aspect-[16/10] w-full overflow-hidden bg-muted">
            {photos[0] ? <CroppedImage src={photos[0].url} crop={photos[0].crop} alt="Party cover photo" className="h-full w-full object-cover" />
              : <span className="grid h-full place-content-center gap-3 text-center"><Upload className="mx-auto h-10 w-10 text-primary" /><span className="font-semibold">Drag your photos here</span><span className="text-sm text-muted-foreground">Or click to choose photos</span></span>}
          </button>
          {photos.length ? <div className="bg-white px-4 py-3 text-sm font-semibold">{isDragOver ? "Drop photos to upload" : "Click to change cover photo"}</div> : null}
        </div>
        {photos.length ? <p className="text-xs text-muted-foreground">Click a photo to edit it or add tags.</p> : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <div key={photo.id}
              className={`relative aspect-[4/3] overflow-hidden rounded-2xl border-2 transition ${selectedPhoto?.id === photo.id ? "border-primary" : "border-transparent"}`}>
              <button type="button" onClick={() => { setSelectedPhotoId(photo.id); setStep(2); }} onDoubleClick={() => setEditingCropPhoto(photo)}
                aria-label={`Edit photo ${index + 1} and tags`} aria-pressed={selectedPhoto?.id === photo.id} className="block h-full w-full">
                <CroppedImage src={photo.url} alt={`Party photo ${index + 1}`} crop={photo.crop} className="h-full w-full object-cover" />
              </button>
              {photo.vendorIds.length ? <span title={`${photo.vendorIds.length} tagged vendors`} className="pointer-events-none absolute bottom-2 left-2 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-foreground shadow-sm"><Tag className="h-4 w-4" /></span> : null}
              {index === 0 ? <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold">Cover</span> : null}
            </div>
          ))}
          <button type="button" disabled={isUploading || photos.length >= 16} onClick={() => { uploadAsCoverRef.current = false; fileInputRef.current?.click(); }}
            onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (!isUploading) void uploadFiles(event.dataTransfer.files); }}
            aria-label="Add more photos" title="Add more photos" className="grid aspect-[4/3] place-content-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-white text-primary transition hover:bg-primary/5 disabled:opacity-50">
            {isUploading ? <Loader2 className="mx-auto h-10 w-10 animate-spin" /> : <Plus className="mx-auto h-12 w-12" />}
            <span className="text-xs font-semibold">{isUploading ? "Uploading…" : "Add photos"}</span>
          </button>
        </div>
      <section className="grid min-w-0 gap-4 rounded-3xl border bg-white p-4" aria-label="Party links">
        <div><h2 className="text-sm font-semibold">Video &amp; music</h2><p className="mt-1 text-xs text-muted-foreground">Add a video of your party and the playlist that set the mood.</p></div>
        <div className="grid gap-3"><h2 className="text-lg font-semibold">Party videos</h2><p className="text-xs text-muted-foreground">Add up to 8 public TikTok videos.</p>
          {tiktokUrls.map((url, index) => <div key={index} className="grid gap-2">
            <label className="grid gap-2 text-sm font-medium">TikTok video {index + 1}<Input name="tiktokUrls" type="url" maxLength={2048} value={url} onChange={(event) => setTikTokUrls((current) => current.map((value, i) => i === index ? event.target.value : value))} placeholder="https://www.tiktok.com/@you/video/…" /></label>
            {url.trim() && !getTikTokVideo(url) && !isTikTokShareUrl(url) ? <p role="status" className="text-xs text-destructive">Paste a TikTok video link.</p> : null}
            {tiktokUrls.length > 1 ? <button type="button" className="w-fit text-xs text-muted-foreground underline" onClick={() => setTikTokUrls((current) => current.filter((_, i) => i !== index))}>Remove video {index + 1}</button> : null}
          </div>)}
          <Button type="button" variant="secondary" className="w-fit" disabled={tiktokUrls.length >= 8} onClick={() => setTikTokUrls((current) => [...current, ""])}>Add another video</Button>
        </div>
        <h2 className="text-lg font-semibold">Party playlists</h2>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Apple Music playlist <span className="text-xs font-normal text-muted-foreground">Optional</span>
          <Input name="appleMusicUrl" type="url" maxLength={2048} value={appleMusicUrl} onChange={(event) => setAppleMusicUrl(event.target.value)} placeholder="https://music.apple.com/us/playlist/…" aria-describedby="party-playlist-help" />
          <span id="party-playlist-help" className="text-xs font-normal text-muted-foreground">Paste a public playlist link. Its cover and player appear automatically.</span>
          {appleMusicUrl.trim() && !getAppleMusicPlaylist(appleMusicUrl) ? <span role="status" className="text-xs text-destructive">Paste a public Apple Music playlist link.</span> : null}
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Spotify playlist <span className="text-xs font-normal text-muted-foreground">Optional</span>
          <Input name="spotifyUrl" type="url" maxLength={2048} value={spotifyUrl} onChange={(event) => setSpotifyUrl(event.target.value)} placeholder="https://open.spotify.com/playlist/…" />
          {spotifyUrl.trim() && !getSpotifyPlaylist(spotifyUrl) ? <span role="status" className="text-xs text-destructive">Paste a public Spotify playlist link.</span> : null}
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Pinterest profile <span className="text-xs font-normal text-muted-foreground">Optional</span><Input name="pinterestUrl" type="url" maxLength={2048} defaultValue={initialParty?.pinterestUrl ?? ""} placeholder="https://www.pinterest.com/yourname/" /></label>
        <PartyMedia tiktokUrls={tiktokUrls} appleMusicUrl={appleMusicUrl} spotifyUrl={spotifyUrl} />
      </section>
      </div>

        </div>
        <div className="grid min-w-0 gap-5">
          <div hidden={!isEditing && step !== 1} className={isEditing ? "order-2 space-y-5" : "space-y-5"}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="grid min-w-0 gap-2 text-sm font-semibold">
          Party title <span className="text-xs font-normal text-muted-foreground">Required</span>
        <Input
          name="title"
          aria-label="Party title"
          placeholder="Give your party a title"
          minLength={2}
          maxLength={100}
          required
          defaultValue={initialParty?.title ?? ""}
          className="min-w-0"
        />
        </label>
        <input type="hidden" name="theme" value={initialParty?.theme ?? ""} />
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Event date <span className="text-xs font-normal text-muted-foreground">Optional</span>
        <Input name="eventDate" type="date" defaultValue={formatDateInputValue(initialParty?.eventDate)} className="min-w-0" />
        <span className="text-xs font-normal text-muted-foreground">Only the month and year appear on your party.</span>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Party category
        <select name="occasion" value={occasion} onChange={(event) => setOccasion(event.target.value)} className="h-12 w-full rounded-2xl border bg-white px-4 text-sm">
          <option value="">Choose a category</option>
          {PARTY_OCCASIONS.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <div className="grid gap-3">
        {privateResidence ? (
          <div className="grid gap-3 rounded-2xl bg-primary/5 p-4 text-sm text-muted-foreground">
            <input type="hidden" name="location" value="Private residence" />
            <p>Only your county will appear publicly. Your home address is never shared.</p>
            <CountySelector initialFips={initialParty?.countyFips} required />
          </div>
        ) : (
      <PlaceAutocompleteInput
        defaultValue={initialParty?.formattedAddress ?? initialParty?.location ?? ""}
        defaultPlace={{
          formattedAddress: initialParty?.formattedAddress ?? initialParty?.location ?? undefined,
          city: initialParty?.city ?? undefined,
          state: initialParty?.state ?? undefined,
          zipCode: initialParty?.zipCode ?? undefined,
          lat: initialParty?.locationLat ?? undefined,
          lng: initialParty?.locationLng ?? undefined,
          placeId: initialParty?.googlePlaceId ?? undefined
        }}
        fieldNames={{
          input: "location",
          formattedAddress: "locationFormattedAddress",
          city: "locationCity",
          state: "locationState",
          zipCode: "locationZipCode",
          lat: "locationLat",
          lng: "locationLng",
          placeId: "locationPlaceId"
        }}
        placeholder="Venue, address, city, or neighborhood"
      />
        )}
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-medium">
          <input type="checkbox" checked={privateResidence} onChange={(event) => setPrivateResidence(event.target.checked)} className="h-3.5 w-3.5 accent-[#d88f9d]" />
          Private residence
        </label>
      </div>
      <input type="hidden" name="description" value={initialParty?.description ?? ""} />



      <PartyCollaboratorPicker
        guestIds={guestIds}
        coHostIds={coHostIds}
        currentUserId={currentUserId}
        mainHostId={mainHostId}
        onAddCoHost={(userId) => {
          if (userId === mainHostId) return;
          setGuestIds((current) => current.filter((id) => id !== userId));
          setCoHostIds((current) => (current.includes(userId) ? current : [...current, userId].slice(0, 12)));
        }}
        onMainHostChange={(userId) => {
          setMainHostId(userId);
          setGuestIds((current) => current.filter((id) => id !== userId));
          setCoHostIds((current) => current.filter((id) => id !== userId));
        }}
        onRemoveCoHost={(userId) => setCoHostIds((current) => current.filter((id) => id !== userId))}
        users={users}
      />
      <PartyCollaboratorPicker
        guestMode
        coHostIds={guestIds}
        guestIds={coHostIds}
        currentUserId={currentUserId}
        mainHostId={mainHostId}
        onAddCoHost={(id) => setGuestIds((current) => current.includes(id) || id === mainHostId || coHostIds.includes(id) ? current : [...current, id].slice(0, 100))}
        onRemoveCoHost={(id) => setGuestIds((current) => current.filter((value) => value !== id))}
        onMainHostChange={setMainHostId}
        users={users}
      />

          </div>
          {(isEditing || step === 2) && selectedPhoto ? (
            <section className={isEditing ? "order-1 space-y-5 rounded-3xl border bg-white p-5" : "space-y-5 rounded-3xl border bg-white p-5"}>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Edit photo & tags</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Select a photo on the left to edit it or add tags.</p>
              </div>
              <button type="button" onClick={() => setEditingCropPhoto(selectedPhoto)} aria-label="Adjust selected photo brightness and crop" className="block aspect-[4/3] w-full overflow-hidden rounded-2xl">
                <CroppedImage src={selectedPhoto.url} crop={selectedPhoto.crop} alt="Selected photo preview" className="h-full w-full object-cover" />
              </button>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Photo {photos.indexOf(selectedPhoto) + 1} of {photos.length}</span>
                <div className="flex flex-wrap gap-2">
                  <IconButton label="Adjust brightness, saturation and crop" onClick={() => setEditingCropPhoto(selectedPhoto)}><SlidersHorizontal className="h-4 w-4" /></IconButton>
                  <IconButton label="Delete photo" onClick={() => removePhoto(selectedPhoto.id)}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              </div>
              <PhotoVendorTagger key={selectedPhoto.id} currentUserId={currentUserId}
                onAddVendor={(vendorId) => togglePhotoVendor(selectedPhoto.id, vendorId, true)}
                onContributionChange={(vendorId, contribution) => setPhotoVendorContribution(selectedPhoto.id, vendorId, contribution)}
                onRatingChange={(vendorId, rating) => setPhotos((current) => current.map((photo) => photo.vendorIds.includes(vendorId) ? { ...photo, vendorRatings: { ...photo.vendorRatings, [vendorId]: rating } } : photo))}
                onCreateVendor={(initialName) => setNewVendorModal({ initialName, photoId: selectedPhoto.id })}
                onRemoveVendor={(vendorId) => togglePhotoVendor(selectedPhoto.id, vendorId, false)}
                photo={selectedPhoto} vendors={vendorOptions} />
            </section>
          ) : null}
          {!isEditing && step === 1 ? (
            <Button type="button" className="party-brand-button h-12 rounded-full text-base font-semibold" disabled={isUploading || photos.length === 0} onClick={goToVendors}>Next: tag vendors</Button>
          ) : (
            <div className="order-3 flex flex-wrap gap-3">
              {!isEditing ? <Button type="button" variant="secondary" onClick={() => setStep(1)}>Back to details</Button> : null}
              <Button type="submit" className="party-brand-button h-12 flex-1 rounded-full text-base font-semibold" disabled={isPending || isUploading || photos.length === 0}>{isPending ? "Saving..." : isEditing ? "Save changes" : "Publish party"}</Button>
            </div>
          )}
      {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
        </div>
      </div>
      {coverPickerOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="cover-picker-title" onKeyDown={(event) => { if (event.key === "Escape") setCoverPickerOpen(false); }} className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 id="cover-picker-title" className="text-2xl font-bold">Select your cover photo</h2>
              <button type="button" aria-label="Close cover picker" onClick={() => setCoverPickerOpen(false)} className="rounded-full p-2"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo, index) => <button key={photo.id} type="button" aria-label={`Choose photo ${index + 1} as cover`} onClick={() => { setEditingCover(true); setEditingCropPhoto(photo); setCoverPickerOpen(false); }} className="relative aspect-[16/10] overflow-hidden rounded-2xl">
                <CroppedImage src={photo.url} crop={photo.crop} alt={`Cover option ${index + 1}`} className="h-full w-full object-cover" />
                {index === 0 ? <span className="absolute bottom-2 left-2 rounded-full bg-white px-3 py-1 text-xs">Current cover</span> : null}
              </button>)}
              <button type="button" disabled={isUploading || photos.length >= 16} onClick={() => { uploadAsCoverRef.current = true; fileInputRef.current?.click(); }} className="grid aspect-square place-content-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 text-primary"><Plus className="mx-auto h-12 w-12" /><span className="text-xs">{isUploading ? "Uploading…" : "Add photos"}</span></button>
            </div>
          </section>
        </div>
      ) : null}
      {editingCropPhoto ? (
        <ImageCropEditor
          aspectLabel={editingCover ? "Edit cover photo" : "Edit party photo"}
          crop={editingCropPhoto.crop}
          imageUrl={editingCropPhoto.url}
          onCancel={() => { setEditingCropPhoto(null); setEditingCover(false); }}
          onSave={(crop) => {
            setPhotoCrop(editingCropPhoto.id, crop);
            if (editingCover) setCoverPhoto(editingCropPhoto.id);
            setEditingCover(false);
            setEditingCropPhoto(null);
          }}
          preserveFrame
          minZoom={1}
          allowAdjustments
          previewClassName={editingCover ? "aspect-[16/10]" : "aspect-[4/3]"}
        />
      ) : null}
      {newVendorModal ? (
        <UnclaimedVendorModal
          initialName={newVendorModal.initialName}
          onClose={() => setNewVendorModal(null)}
          onCreated={(vendor) => {
            addCreatedVendor(newVendorModal.photoId, vendor);
            setNewVendorModal(null);
          }}
        />
      ) : null}
    </form>
  );
}

function IconButton({
  children,
  disabled,
  label,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full border bg-white text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

const UNCLAIMED_VENDOR_CATEGORIES = [
  "Backdrops",
  "Balloons",
  "Cakes & Desserts",
  "Catering & Beverages",
  "Children's Entertainment",
  "Entertainment",
  "Florals",
  "Party Rentals",
  "Styling & Decor"
] as const;

function UnclaimedVendorModal({
  initialName,
  onClose,
  onCreated
}: {
  initialName: string;
  onClose: () => void;
  onCreated: (vendor: VendorOption) => void;
}) {
  const [name, setName] = useState(initialName);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [website, setWebsite] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function toggleCategory(category: string, checked: boolean) {
    setCategories((current) =>
      checked
        ? current.includes(category) ? current : [...current, category]
        : current.filter((item) => item !== category)
    );
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#2f2626]/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[1.5rem] border border-white/70 bg-[#fffaf7] shadow-[0_28px_80px_rgba(72,44,43,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#eadbd7] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Unclaimed vendor</p>
            <h2 className="mt-1 text-xl font-semibold">Add New Vendor</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Add a lightweight profile so this party can credit the business now.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-muted-foreground shadow-sm transition hover:text-foreground"
            aria-label="Close add vendor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 p-5">
          <label className="grid gap-1.5 text-sm font-semibold">
            Business Name
            <Input value={name} onChange={(event) => setName(event.target.value)} className="h-11 rounded-[1rem] bg-white" required />
          </label>
          <div className="grid gap-2 text-sm font-semibold">
            Categories
            <div className="flex flex-wrap gap-2">
              {UNCLAIMED_VENDOR_CATEGORIES.map((item) => (
                <label key={item} className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={categories.includes(item)}
                    onChange={(event) => toggleCategory(item, event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
          <label className="grid gap-1.5 text-sm font-semibold">
            Instagram Handle <span className="font-normal text-muted-foreground">(optional)</span>
            <Input value={instagramHandle} onChange={(event) => setInstagramHandle(event.target.value)} placeholder="@businessname" className="h-11 rounded-[1rem] bg-white" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Website <span className="font-normal text-muted-foreground">(optional)</span>
            <Input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="business.com" className="h-11 rounded-[1rem] bg-white" />
          </label>
          {error ? <p className="rounded-[1rem] bg-primary/10 px-3 py-2 text-sm text-primary">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#eadbd7] bg-white px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await createUnclaimedVendorAction({ categories, instagramHandle, name, website });
                if (!result.ok || !result.vendor) {
                  setError(result.error ?? "Could not add that vendor yet.");
                  return;
                }
                onCreated(result.vendor);
              });
            }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Vendor
          </Button>
        </div>
      </div>
    </div>
  );
}

function PartyCollaboratorPicker({
  guestMode = false,
  guestIds = [],
  coHostIds,
  currentUserId,
  mainHostId,
  onAddCoHost,
  onMainHostChange,
  onRemoveCoHost,
  users
}: {
  guestMode?: boolean;
  guestIds?: string[];
  coHostIds: string[];
  currentUserId: string;
  mainHostId: string;
  onAddCoHost: (userId: string) => void;
  onMainHostChange: (userId: string) => void;
  onRemoveCoHost: (userId: string) => void;
  users: UserOption[];
}) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const mainHost = userMap.get(mainHostId) ?? userMap.get(currentUserId) ?? users[0];
  const selectedIds = new Set([mainHostId, ...coHostIds, ...guestIds]);
  const matches = users
    .filter((user) => {
      if (selectedIds.has(user.id)) return false;
      const haystack = `${user.name ?? ""} ${user.username ?? ""}`.toLowerCase();
      return query.trim() ? haystack.includes(query.trim().toLowerCase()) : user.id !== currentUserId;
    })
    .slice(0, 6);

  return (
    <section className="grid min-w-0 gap-3 rounded-[1.5rem] border bg-white p-4">
      <div>
        <p className="text-sm font-semibold">{guestMode ? "Guests" : "Hosted by"}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {guestMode ? "Celebrate with the people who joined you." : "Celebrate together. Invite anyone who helped you host."}
        </p>
      </div>

      {!guestMode ? <div className="grid gap-2">
        <div className="grid min-w-0 gap-2">
          <div className="flex min-w-0 items-center gap-3 rounded-2xl border bg-[#fffaf8] px-3 py-2">
            {mainHost ? <UserAvatar user={mainHost} /> : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{getUserDisplayName(mainHost)}{mainHostId === currentUserId ? " (you)" : ""}</p>
            </div>
          </div>
          <details className="text-xs">
            <summary className="w-fit cursor-pointer text-muted-foreground">Change host</summary>
          <select aria-label="Choose party host"
            value={mainHostId}
            onChange={(event) => onMainHostChange(event.target.value)}
            className="h-12 min-w-0 rounded-2xl border bg-white px-3 text-sm outline-none transition focus:border-primary"
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {getUserDisplayName(user)} {user.username ? `(@${user.username})` : ""}
              </option>
            ))}
          </select>
          </details>
        </div>
      </div> : null}

      <div className="grid min-w-0 gap-2">
        <label className="text-sm font-semibold" htmlFor={guestMode ? "party-guests" : "party-cohosts"}>{guestMode ? "Add guests" : "Add co-hosts"}</label>
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id={guestMode ? "party-guests" : "party-cohosts"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
            placeholder="Type a name or username"
            className="h-12 w-full rounded-2xl border bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary"
          />
          {isFocused && matches.length > 0 ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-30 overflow-hidden rounded-[1.2rem] border bg-white shadow-soft">
              {matches.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onAddCoHost(user.id);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-primary/5"
                >
                  <UserAvatar user={user} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{getUserDisplayName(user)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{getUserHandle(user)}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {coHostIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {coHostIds.map((userId) => {
              const user = userMap.get(userId);
              if (!user) return null;
              return (
                <button
                  key={userId}
                  type="button"
                  onClick={() => onRemoveCoHost(userId)}
                  className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-medium transition hover:border-primary/30 hover:bg-primary/5"
                  aria-label={`Remove ${getUserDisplayName(user)}`}
                >
                  <UserAvatar user={user} size="sm" />
                  {getUserDisplayName(user)}
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Optional. They’ll appear on the party after accepting your invitation.</p>
        )}
      </div>
    </section>
  );
}

function UserAvatar({ size = "md", user }: { size?: "sm" | "md"; user?: UserOption }) {
  const className = size === "sm" ? "h-5 w-5 text-[10px]" : "h-9 w-9 text-xs";
  const savedImage = getSafeProfileImage(user?.image);
  if (savedImage) {
    return <img src={savedImage} alt="" className={`${className} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span className={`${className} grid shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary`}>
      {getUserDisplayName(user).slice(0, 2).toUpperCase()}
    </span>
  );
}

function getUserDisplayName(user?: UserOption) {
  return user?.name ?? user?.username ?? "ShopFia host";
}

function getUserHandle(user?: UserOption) {
  return user?.username ? `@${user.username}` : "Creator profile";
}

function formatDateInputValue(value?: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function PhotoVendorTagger({
  currentUserId,
  onAddVendor,
  onContributionChange,
  onRatingChange,
  onCreateVendor,
  onRemoveVendor,
  photo,
  vendors
}: {
  currentUserId: string;
  onAddVendor: (vendorId: string) => void;
  onContributionChange: (vendorId: string, contribution: string) => void;
  onRatingChange: (vendorId: string, rating: number) => void;
  onCreateVendor: (initialName: string) => void;
  onRemoveVendor: (vendorId: string) => void;
  photo: UploadedPartyPhoto;
  vendors: VendorOption[];
}) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const selectedVendors = vendors.filter((vendor) => photo.vendorIds.includes(vendor.id));
  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return vendors.filter((vendor) => !photo.vendorIds.includes(vendor.id)).slice(0, 5);
    }

    return vendors
      .filter((vendor) => {
        if (photo.vendorIds.includes(vendor.id)) return false;
        return [
          vendor.name,
          vendor.username ? `@${vendor.username}` : "",
          vendor.city,
          vendor.state ?? ""
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .slice(0, 5);
  }, [photo.vendorIds, query, vendors]);
  const trimmedQuery = query.trim();
  const showAddVendor = trimmedQuery.length > 0;
  const addVendorButton = showAddVendor ? (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        onCreateVendor(trimmedQuery);
        setQuery("");
        setIsFocused(false);
      }}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#fff7f4]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Plus className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">Add New Vendor</span>
        <span className="block truncate text-xs text-muted-foreground">
          Create an unclaimed profile for “{trimmedQuery}”
        </span>
      </span>
    </button>
  ) : null;
  const showDropdown = isFocused && (trimmedQuery.length > 0 || matches.length > 0);

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
          placeholder="Search vendor name or username"
          className="h-11 rounded-full border-[#eadbd7] bg-white pl-9 shadow-none"
        />
        {showDropdown ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-20 overflow-hidden rounded-[1.2rem] border border-[#eadbd7] bg-white shadow-[0_16px_42px_rgba(80,55,45,0.13)]">
            {matches.length === 0 ? addVendorButton : null}
            {matches.length > 0 ? (
              <>
                {matches.map((vendor) => (
                  <button
                    key={vendor.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onAddVendor(vendor.id);
                      setQuery("");
                      setIsFocused(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#fff7f4]"
                  >
                    <VendorAvatar vendor={vendor} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{vendor.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {vendor.status === "UNCLAIMED" ? "Unclaimed vendor" : vendor.username ? `@${vendor.username}` : "Vendor profile"}
                        {vendor.city ? ` · ${vendor.city}${vendor.state ? `, ${vendor.state}` : ""}` : ""}
                      </span>
                    </span>
                  </button>
                ))}
                {addVendorButton}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {selectedVendors.length > 0 ? (
        <div className="grid gap-2">
          {selectedVendors.map((vendor) => (
            <div
              key={vendor.id}
              className="rounded-[1rem] border border-[#eadbd7] bg-[#fffaf8] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <VendorAvatar vendor={vendor} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{vendor.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {vendor.status === "UNCLAIMED" ? "Unclaimed vendor" : vendor.username ? `@${vendor.username}` : "Tagged vendor"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveVendor(vendor.id)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-muted-foreground transition hover:text-foreground"
                  aria-label={`Remove ${vendor.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <VendorFollowPrompt vendor={vendor} currentUserId={currentUserId} />
              <fieldset className="mt-4">
                <legend className="text-sm font-semibold">How was your experience with {vendor.name}?</legend>
                <p className="mt-1 text-xs text-muted-foreground">Required · rate the vendor you used for this party.</p>
                <div className="mt-2 flex gap-1" role="radiogroup" aria-label={`Rate ${vendor.name}`}>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button key={rating} type="button" role="radio" aria-checked={(photo.vendorRatings?.[vendor.id] ?? 0) === rating}
                      aria-label={`${rating} star${rating === 1 ? "" : "s"}`} onClick={() => onRatingChange(vendor.id, rating)}
                      className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2">
                      <Star className={`h-6 w-6 ${(photo.vendorRatings?.[vendor.id] ?? 0) >= rating ? "fill-current" : ""}`} />
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="mt-3 grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor={`vendor-credit-${photo.id}-${vendor.id}`}>
                  Contribution note
                </label>
                <Textarea
                  id={`vendor-credit-${photo.id}-${vendor.id}`}
                  value={photo.vendorContributions[vendor.id] ?? ""}
                  onChange={(event) => onContributionChange(vendor.id, event.target.value)}
                  placeholder="Optional: e.g. balloon arch, dessert table, florals, setup styling..."
                  className="min-h-20 rounded-[1rem] border-[#eadbd7] bg-white text-sm shadow-none"
                  maxLength={220}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Search and tag the vendors who contributed to this photo.
        </p>
      )}
    </div>
  );
}

function VendorAvatar({ vendor }: { vendor: VendorOption }) {
  if (vendor.status !== "UNCLAIMED" && vendor.logoUrl) {
    return (
      <img
        src={vendor.logoUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {vendor.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

async function uploadPartyPhoto(file: File) {
  const uploadFile = await preparePartyPhotoFile(file);
  const formData = new FormData();
  formData.set("file", uploadFile);
  const response = await fetch("/api/uploads/party-photo", {
    method: "POST",
    body: formData
  });

  const responseText = await response.text();
  const result = parseUploadResponse(responseText) as {
    error?: string;
    photo?: { id: string; url: string };
  };

  if (!response.ok || !result.photo) {
    throw new Error(result.error ?? getUploadErrorMessage(response, responseText));
  }

  return {
    ...result.photo,
    crop: DEFAULT_IMAGE_CROP,
    vendorIds: [],
    vendorContributions: {},
    vendorRatings: {}
  };
}

function parseUploadResponse(responseText: string) {
  if (!responseText) return {};
  try {
    return JSON.parse(responseText);
  } catch {
    return {};
  }
}

function getUploadErrorMessage(response: Response, responseText: string) {
  if (response.status === 413 || /^request entity too large/i.test(responseText)) {
    return "That photo is too large for upload. Try a smaller image or screenshot version.";
  }

  return "That photo could not be uploaded. Try a JPG, PNG, or WebP under 3.5MB.";
}

async function preparePartyPhotoFile(file: File) {
  if (!SUPPORTED_PARTY_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use a JPG, PNG, WebP, or GIF image.");
  }

  if (file.type === "image/gif") {
    if (file.size > MAX_PARTY_UPLOAD_BYTES) {
      throw new Error("That GIF is too large. Choose a GIF under 3.5MB.");
    }
    return file;
  }

  if (file.size <= MAX_PARTY_UPLOAD_BYTES) {
    return file;
  }

  return compressImageFile(file);
}

async function compressImageFile(file: File) {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_PARTY_UPLOAD_DIMENSION / Math.max(image.width, image.height));
  let width = Math.max(1, Math.round(image.width * scale));
  let height = Math.max(1, Math.round(image.height * scale));

  for (const quality of [0.86, 0.78, 0.7, 0.62]) {
    const blob = await renderImageBlob(image, width, height, quality);
    if (blob.size <= MAX_PARTY_UPLOAD_BYTES) {
      URL.revokeObjectURL(image.src);
      return new File([blob], replaceExtension(file.name, "jpg"), { type: "image/jpeg" });
    }
  }

  width = Math.max(1, Math.round(width * 0.75));
  height = Math.max(1, Math.round(height * 0.75));
  const blob = await renderImageBlob(image, width, height, 0.62);
  URL.revokeObjectURL(image.src);

  if (blob.size > MAX_PARTY_UPLOAD_BYTES) {
    throw new Error("That photo is too large. Try a smaller image or screenshot version.");
  }

  return new File([blob], replaceExtension(file.name, "jpg"), { type: "image/jpeg" });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be read. Try a JPG, PNG, or WebP photo."));
    };
    image.src = url;
  });
}

function renderImageBlob(image: HTMLImageElement, width: number, height: number, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("That image could not be prepared for upload."));
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("That image could not be prepared for upload."));
      },
      "image/jpeg",
      quality
    );
  });
}

function replaceExtension(filename: string, extension: string) {
  const safeName = filename.replace(/[\\/]/g, "-");
  return safeName.replace(/\.[^.]+$/, "") + `.${extension}`;
}


function VendorFollowPrompt({ vendor }: { vendor: VendorOption; currentUserId: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (dismissed || vendor.status === "UNCLAIMED") return null;
  return <div className="mt-3 rounded-xl bg-primary/5 p-3">
    {following ? <p role="status" className="text-sm font-medium text-green-700">Following {vendor.name}</p> : <>
      <p className="text-sm font-medium">Would you like to follow {vendor.name}?</p>
      <div className="mt-2 flex gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => startTransition(async () => {
          setError(null);
          try {
            const result = await followPartyVendorAction(vendor.id);
            if (result.ok) setFollowing(true); else setError(result.error ?? "Could not follow this vendor.");
          } catch { setError("Could not follow this vendor. Please try again."); }
        })}>{pending ? "Following..." : "Follow vendor"}</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setDismissed(true)}>Not now</Button>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
    </>}
  </div>;
}
