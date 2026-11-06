"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, SlidersHorizontal, Trash2, Loader2, Plus, Search, Star, Upload, X, Tag } from "lucide-react";
import { createPartyEventAction, updatePartyEventAction, followPartyVendorAction } from "@/app/actions/auth";
import { UnclaimedVendorSocialEditor } from "@/components/parties/unclaimed-vendor-social-editor";
import { PartyClassificationFields } from "@/components/parties/party-classification-fields";
import { UnclaimedVendorModal } from "@/components/parties/unclaimed-vendor-modal";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";
import { PartyMedia } from "@/components/parties/party-media";
import { PartifulArtwork } from "@/components/parties/partiful-artwork";
import { PartySelect } from "@/components/parties/party-select";
import { Button } from "@/components/ui/button";
import { CroppedImage } from "@/components/ui/cropped-image";
import { CountySelector } from "@/components/parties/county-selector";
import { collectPartyVendorRatings } from "@/lib/party-vendor-ratings";
import { getPartyInvitation } from "@/lib/party-invitation";
import { getAppleMusicPlaylist, getTikTokVideo, isTikTokShareUrl, getSpotifyPlaylist } from "@/lib/party-media";
import { PartyPhotoEditor } from "@/components/parties/party-photo-editor";
import * as Dialog from "@radix-ui/react-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_IMAGE_CROP, normalizePartyPhotoCrop, type ImageCrop } from "@/lib/image-crop";
import { getSafeProfileImage } from "@/lib/profile-image";

import { inferPartyOccasion } from "@/lib/party-occasions";

const MAX_PARTY_UPLOAD_BYTES = 3.5 * 1024 * 1024;
const MAX_PARTY_UPLOAD_DIMENSION = 2400;
const SUPPORTED_PARTY_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type VendorOption = {
  id: string;
  name: string;
  username: string | null;
  city: string;
  state: string | null;
  logoUrl: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  website?: string | null;
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
  vendorRatings?: Record<string, number>;
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

export function PartyEventForm({ currentUserId, initialParty, users, vendors }: PartyEventFormProps) {
  const isEditing = Boolean(initialParty);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(initialParty?.photos[0]?.id ?? null);
  const formRef = useRef<HTMLFormElement>(null);
  const coverPhotoRef = useRef<HTMLButtonElement>(null);
  const touchPhotoDrag = useRef<{id: string; x: number; y: number} | null>(null);
  const [coverDropActive, setCoverDropActive] = useState(false);
  const tagPanelRef = useRef<HTMLElement>(null);
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
  const [partyVendorRatings, setPartyVendorRatings] = useState(() => collectPartyVendorRatings(initialParty?.photos ?? [], initialParty?.vendorRatings));
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>(vendors);
  const [mainHostId, setMainHostId] = useState(initialParty?.mainHostId ?? currentUserId);
  const [tiktokUrls, setTikTokUrls] = useState<string[]>(() => initialParty?.tiktokUrls?.length ? initialParty.tiktokUrls : [initialParty?.tiktokUrl ?? ""]);
  const [invitationService, setInvitationService] = useState(() => initialParty?.partyfulUrl ? (getPartyInvitation(initialParty.partyfulUrl)?.provider ?? "partiful") : "");
  const [invitationLinks, setInvitationLinks] = useState({ partiful: getPartyInvitation(initialParty?.partyfulUrl)?.provider === "partiful" ? initialParty?.partyfulUrl ?? "" : "", luma: getPartyInvitation(initialParty?.partyfulUrl)?.provider === "luma" ? initialParty?.partyfulUrl ?? "" : "" });
  const partyfulUrl = invitationService === "luma" ? invitationLinks.luma : invitationLinks.partiful;
  const setPartyfulUrl = (value: string) => setInvitationLinks(current => ({...current, [invitationService || "partiful"]: value}));
  const [visualService, setVisualService] = useState(initialParty?.tiktokUrls?.some(Boolean) || initialParty?.tiktokUrl ? "tiktok" : initialParty?.pinterestUrl ? "pinterest" : "");
  const [audioService, setAudioService] = useState(initialParty?.appleMusicUrl ? "apple" : initialParty?.spotifyUrl ? "spotify" : "");
  const [pinterestUrl, setPinterestUrl] = useState(initialParty?.pinterestUrl ?? "");
  const [spotifyUrl, setSpotifyUrl] = useState(initialParty?.spotifyUrl ?? "");
  const [appleMusicUrl, setAppleMusicUrl] = useState(initialParty?.appleMusicUrl ?? "");
  const [guestIds, setGuestIds] = useState<string[]>(() => initialParty?.guestIds ?? []);
  const [coHostIds, setCoHostIds] = useState<string[]>(() => initialParty?.coHostIds ?? []);
  const [taggingOpen, setTaggingOpen] = useState(false);
  useEffect(() => {
    if (taggingOpen && step === 4) tagPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [taggingOpen, step]);
  const [editingCropPhoto, setEditingCropPhoto] = useState<UploadedPartyPhoto | null>(null);
  const [newVendorModal, setNewVendorModal] = useState<{ initialName: string; photoId: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editingCover, setEditingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(fileList: FileList | File[]) {
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
      setSelectedPhotoId(uploaded[0]?.id ?? null);
      setStep(1);
      setEditingCover(false);
      setEditingCropPhoto(uploaded[0] ?? null);
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
  function advanceStep() {
    if (!photos.length) { setMessage("Add at least one photo first."); return; }
    setMessage(null);
    if (step === 2 || step === 3) {
      const section = formRef.current?.querySelector(step === 2 ? '[data-party-step="details"]' : '[data-party-step="inspiration"]');
      const invalid = section?.querySelector<HTMLInputElement>("input:invalid, select:invalid, textarea:invalid");
      if (invalid) { invalid.reportValidity(); return; }
    }
    setStep((current) => current === 1 ? 2 : current === 2 ? 3 : 4);
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

  const photoTagger = selectedPhoto ? (
    <PhotoVendorTagger
      onSocialsUpdated={(vendorId, socials) => setVendorOptions((current) => current.map((vendor) => vendor.id === vendorId ? { ...vendor, ...socials } : vendor))} key={selectedPhoto.id} currentUserId={currentUserId}
                onAddVendor={(vendorId) => togglePhotoVendor(selectedPhoto.id, vendorId, true)}
                onContributionChange={(vendorId, contribution) => setPhotoVendorContribution(selectedPhoto.id, vendorId, contribution)}
                partyVendorRatings={partyVendorRatings}
                onRatingChange={(vendorId, rating) => setPartyVendorRatings((current) => ({ ...current, [vendorId]: rating }))}
                onCreateVendor={(initialName) => setNewVendorModal({ initialName, photoId: selectedPhoto.id })}
                onRemoveVendor={(vendorId) => togglePhotoVendor(selectedPhoto.id, vendorId, false)}
                photo={selectedPhoto} vendors={vendorOptions} />
  ) : null;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        if (step !== 4) { event.preventDefault(); advanceStep(); return; }
        if (!formRef.current?.checkValidity()) {
          event.preventDefault();
          const invalid = formRef.current?.querySelector<HTMLInputElement>(":invalid");
          if (invalid?.closest('[data-party-step="details"]')) setStep(2);
          else setStep(3);
          if (invalid?.name === "tiktokUrls") setVisualService("tiktok");
          if (invalid?.name === "pinterestUrl") setVisualService("pinterest");
          if (invalid?.name === "appleMusicUrl") setAudioService("apple");
          if (invalid?.name === "spotifyUrl") setAudioService("spotify");
          requestAnimationFrame(() => formRef.current?.reportValidity());
        }
      }}
      action={(formData) => {
        setMessage(null);
        const existingVendorIds = new Set(initialParty?.photos.flatMap((photo) => photo.vendorIds) ?? []);
        const missingRatingPhoto = photos.find((photo) => photo.vendorIds.some((id) => !existingVendorIds.has(id) && !partyVendorRatings[id]));
        if (missingRatingPhoto) {
          setSelectedPhotoId(missingRatingPhoto.id);
          setStep(4);
          setTaggingOpen(true);
          setMessage("Rate each tagged vendor before saving your party.");
          return;
        }
        if (initialParty) {
          formData.set("eventId", initialParty.id);
        }
        formData.set("mainHostId", mainHostId);
        guestIds.forEach((id) => formData.append("guestIds", id));
        coHostIds.forEach((id) => formData.append("coHostIds", id));
        formData.set(
          "photos",
          JSON.stringify(photos.map(({ crop, id, vendorContributions, vendorIds }) => ({ crop, id, vendorContributions, vendorIds, vendorRatings: Object.fromEntries(vendorIds.filter((vendorId) => partyVendorRatings[vendorId]).map((vendorId) => [vendorId, partyVendorRatings[vendorId]])) })))
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
      <nav aria-label="Party creation steps" className="grid h-14 grid-cols-[5rem_minmax(0,1fr)_5rem] items-center border-b">
        <Button type="button" variant="ghost" size="icon" aria-label="Back" disabled={step === 1 || isUploading || isPending} onClick={() => setStep(step === 4 ? 3 : step === 3 ? 2 : 1)}><ArrowLeft aria-hidden="true" className="h-5 w-5" /></Button>
        <span aria-live="polite" className="text-center text-sm font-semibold">{step === 1 ? "Photos" : step === 2 ? "Party Info" : step === 3 ? "Party Details" : "Vendors"}</span>
        {step < 4 ? <Button type="button" variant="ghost" className="justify-self-end font-semibold text-[#994458] hover:bg-[#fff0f2]" disabled={!photos.length || isUploading} onClick={(event) => { event.preventDefault(); advanceStep(); }}>Next</Button> : <Button type="submit" variant="ghost" className="justify-self-end font-semibold text-[#994458] hover:bg-[#fff0f2]" disabled={isPending || isUploading || !photos.length}>{isPending ? "Publishing…" : "Publish"}</Button>}
      </nav>
      <div className={step >= 2 ? "grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" : "mx-auto grid w-full max-w-3xl min-w-0 gap-5"}>
        <section aria-label="Party photos" className="min-w-0 space-y-4 lg:sticky lg:top-5">
          {step === 3 ? <section aria-label="Live party details preview" className="space-y-5">
            <p className="text-xs font-medium text-muted-foreground">Your party preview</p>
            {tiktokUrls.some(Boolean) || pinterestUrl || appleMusicUrl || spotifyUrl || partyfulUrl ? <><PartyMedia tiktokUrls={tiktokUrls} pinterestUrl={pinterestUrl} appleMusicUrl={appleMusicUrl} spotifyUrl={spotifyUrl} /><PartifulArtwork url={partyfulUrl} /></> : <div className="rounded-3xl border border-dashed bg-[#faf9f8] p-8 text-center text-sm leading-6 text-muted-foreground">Add a video, board, playlist, or invitation to see how it will appear on your party page.</div>}
          </section> : null}
          <div hidden={step === 3} className="space-y-4">
          <input ref={fileInputRef} type="file" accept="image/*" multiple disabled={isUploading} className="sr-only" onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); }} />
          <div className="overflow-hidden rounded-3xl border bg-muted" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (!isUploading) void uploadFiles(event.dataTransfer.files); }}>
            <button type="button" aria-label={selectedPhoto ? (step === 4 ? "Tag vendors in selected photo" : "Edit selected photo") : "Upload your party photos"} onClick={() => { if (!selectedPhoto) fileInputRef.current?.click(); else if (step === 4) setTaggingOpen(true); else { setEditingCover(false); setEditingCropPhoto(selectedPhoto); } }} className="relative block aspect-[4/3] max-h-[60dvh] w-full">
              {selectedPhoto ? <CroppedImage src={selectedPhoto.url} crop={selectedPhoto.crop} frameFit="contain" alt="Selected party photo" className="h-full w-full object-contain" /> : <span className="grid h-full place-content-center gap-3 p-6 text-center"><Upload className="mx-auto h-10 w-10 text-primary" /><span className="font-semibold">Choose your party photos</span><span className="text-sm text-muted-foreground">Select up to 16 photos, or drag them here.</span></span>}
              {selectedPhoto && step === 4 ? <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-xs font-medium shadow-sm">Tap photo to tag vendors</span> : null}
            </button>
          </div>
          {selectedPhoto && step === 1 ? <div className="flex items-center justify-end gap-3">
            <div className="flex items-center gap-2">
              {step === 1 ? <Button type="button" variant="secondary" size="icon" aria-label="Crop and edit photo" title="Crop and edit photo" className="h-9 w-9 rounded-full text-gray-500" onClick={() => { setEditingCover(false); setEditingCropPhoto(selectedPhoto); }}><SlidersHorizontal aria-hidden="true" className="h-4 w-4" /></Button> : null}
              <Button type="button" variant="secondary" size="icon" aria-label="Delete photo" title="Delete photo" className="h-9 w-9 rounded-full border-gray-200 bg-white/90 text-gray-500 hover:bg-gray-100 hover:text-gray-700" onClick={() => removePhoto(selectedPhoto.id)}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button>
            </div>
          </div> : null}
          {photos.length > 1 ? <p id="cover-photo-help" className="text-xs leading-5 text-muted-foreground">Drag any photo into the cover photo box on the far left to make it your cover.</p> : null}
          <div className="flex gap-3 overflow-x-auto pb-2" aria-label="Selected photos">
            {photos.map((photo, index) => <button key={photo.id} ref={index === 0 ? coverPhotoRef : undefined} type="button" draggable
              aria-label={`Select photo ${index + 1}`} aria-describedby={photos.length > 1 ? "cover-photo-help" : undefined} aria-pressed={selectedPhoto?.id === photo.id}
              onDragStart={(event) => { event.dataTransfer.setData("application/x-shopfia-photo", photo.id); event.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(event) => { if (index === 0) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setCoverDropActive(true); } }}
              onDragLeave={() => { if (index === 0) setCoverDropActive(false); }}
              onDrop={(event) => { if (index !== 0) return; event.preventDefault(); event.stopPropagation(); setCoverDropActive(false); const id = event.dataTransfer.getData("application/x-shopfia-photo"); setCoverPhoto(id); }}
              onDragEnd={() => setCoverDropActive(false)}
              onPointerDown={(event) => { if (event.pointerType === "mouse") return; touchPhotoDrag.current = {id: photo.id, x: event.clientX, y: event.clientY}; event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerUp={(event) => { const drag = touchPhotoDrag.current; touchPhotoDrag.current = null; if (!drag || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 20) return; const box = coverPhotoRef.current?.getBoundingClientRect(); if (box && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom) setCoverPhoto(drag.id); }}
              onPointerCancel={() => { touchPhotoDrag.current = null; }}
              onKeyDown={(event) => { if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); setCoverPhoto(photo.id); } }}
              onClick={() => { setSelectedPhotoId(photo.id); setTaggingOpen(false); }}
              className={`relative h-24 w-24 shrink-0 touch-pan-y overflow-hidden rounded-2xl border-2 p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${index === 0 ? `border-[#d9a1ad] bg-[#fff0f2] ${coverDropActive ? "ring-4 ring-primary/25" : ""}` : selectedPhoto?.id === photo.id ? "border-[#c4b9b5] bg-[#f5f3f1]" : "border-transparent"}`}>
              <CroppedImage src={photo.url} crop={photo.crop} frameFit="contain" alt={`Party photo ${index + 1}`} className={`w-full rounded-xl object-cover ${index === 0 ? "h-[calc(100%_-_1.25rem)]" : "h-full"}`} />
              {index === 0 ? <span className="absolute inset-x-0 bottom-0 bg-[#fff0f2] py-1 text-[10px] font-semibold text-[#994458]">Cover photo</span> : null}
              <span className="sr-only">Press Alt and left arrow to make this the cover photo.</span>
            </button>)}
            <button type="button" disabled={isUploading || photos.length >= 16} aria-label="Add more photos" onClick={() => { fileInputRef.current?.click(); }} className="grid h-20 w-20 shrink-0 place-content-center rounded-xl border border-dashed border-primary/40 text-primary disabled:opacity-50">{isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-6 w-6" />}</button>
          </div>
          </div>
        </section>
        <div className="min-w-0 space-y-5">
        <div hidden={step !== 2} data-party-step="details" className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">These details help others discover parties like yours for inspiration—from the theme and occasion to celebrations nearby.</p>
      <section aria-label="Party name" className="grid min-w-0 gap-3 rounded-2xl border bg-white p-4">
        <label className="grid min-w-0 gap-2 text-sm font-semibold">
          <span>Party title <span className="text-[#a34d65]" aria-hidden="true">*</span><span className="sr-only"> (required)</span></span>
        <Input
          name="title"
          aria-label="Party title"
          placeholder="Give your party a title"
          minLength={2}
          maxLength={100}
          required
          defaultValue={initialParty?.title ?? ""}
          className="h-12 min-w-0 rounded-xl"
        />
        </label>
      </section>
          <section aria-labelledby="party-host-heading" className="rounded-2xl border bg-white p-4"><h3 id="party-host-heading" className="text-sm font-semibold">Host</h3><div className="mt-4 space-y-4">      <PartyCollaboratorPicker
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
</div></section>
      <section aria-labelledby="party-location-heading" className="grid gap-3 rounded-2xl border bg-white p-4"><h3 id="party-location-heading" className="text-sm font-semibold">Party location</h3><p className="text-xs leading-5 text-muted-foreground">Where did you celebrate? Choose a venue or city, or select private residence to keep your home address private.</p>
        {privateResidence ? (
          <div className="grid gap-3 rounded-2xl bg-primary/5 p-4 text-sm text-muted-foreground">
            <input type="hidden" name="location" value="Private residence" />
            <p>Your county helps people find nearby parties. It isn’t displayed on your party, and your home address stays private.</p>
            <CountySelector initialFips={initialParty?.countyFips} required />
          </div>
        ) : (
      <PlaceAutocompleteInput
            requireSelection
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
      </section>


          <div className="space-y-5">
      <PartyClassificationFields category={occasion} onCategoryChange={setOccasion} tags={initialParty?.tags ?? []} eventDate={initialParty?.eventDate} theme={initialParty?.theme} />
      <input type="hidden" name="description" value={initialParty?.description ?? ""} />




          </div>
        </div>
          <div hidden={step !== 3} data-party-step="inspiration" className="space-y-5"><div><h2 className="text-xl font-semibold">Party Details</h2><p className="mt-2 text-sm text-muted-foreground">Add playlists, videos, and inspiration. Everything here is optional.</p></div>      <div className="grid min-w-0 gap-5" aria-label="Party links">
        <section aria-label="Visuals" className="grid gap-4 rounded-2xl border bg-white p-4">
          <h2 className="text-lg font-semibold">Visuals</h2>
          <p className="text-xs text-muted-foreground">Share the videos and boards that inspired your celebration.</p>
          <label className="grid gap-2 text-sm font-medium">Choose a platform<PartySelect label="Visual platform" value={visualService} onChange={setVisualService} placeholder="Select TikTok or Pinterest" options={[{value: "tiktok", label: "TikTok"}, {value: "pinterest", label: "Pinterest"}]} /></label>
          <div hidden={visualService !== "tiktok"} className={visualService === "tiktok" ? "grid gap-3" : "hidden"}>          {tiktokUrls.map((url, index) => <div key={index} className="grid gap-2">
            <label className="grid gap-2 text-sm font-medium">TikTok video {index + 1}<Input name="tiktokUrls" type="url" maxLength={2048} value={url} onChange={(event) => setTikTokUrls((current) => current.map((value, i) => i === index ? event.target.value : value))} placeholder="https://www.tiktok.com/@you/video/…" /></label>
            {url.trim() && !getTikTokVideo(url) && !isTikTokShareUrl(url) ? <p role="status" className="text-xs text-destructive">Paste a TikTok video link.</p> : null}
            {tiktokUrls.length > 1 ? <button type="button" className="w-fit text-xs text-muted-foreground underline" onClick={() => setTikTokUrls((current) => current.filter((_, i) => i !== index))}>Remove video {index + 1}</button> : null}
          </div>)}
          <Button type="button" variant="secondary" className="w-fit" disabled={tiktokUrls.length >= 8} onClick={() => setTikTokUrls((current) => [...current, ""])}>Add another video</Button>
</div>
          <div hidden={visualService !== "pinterest"}>        <label className="grid min-w-0 gap-2 text-sm font-medium">Pinterest mood board <span className="text-xs font-normal text-muted-foreground">Optional</span><Input name="pinterestUrl" type="url" maxLength={2048} value={pinterestUrl} onChange={(event) => setPinterestUrl(event.target.value)} placeholder="Pinterest board URL or pin.it share link" /></label>
</div>
        </section>
        <section aria-label="Audio" className="grid gap-4 rounded-2xl border bg-white p-4">
          <h2 className="text-lg font-semibold">Audio</h2><p className="text-xs text-muted-foreground">Share your party’s soundtrack.</p>
          <label className="grid gap-2 text-sm font-medium">Choose your music service<PartySelect label="Music service" value={audioService} onChange={setAudioService} placeholder="Select Apple Music or Spotify" options={[{value: "apple", label: "Apple Music"}, {value: "spotify", label: "Spotify"}]} /></label>
          <div hidden={audioService !== "apple"}>        <label className="grid min-w-0 gap-2 text-sm font-medium">Apple Music playlist <span className="text-xs font-normal text-muted-foreground">Optional</span>
          <Input name="appleMusicUrl" type="url" maxLength={2048} value={appleMusicUrl} onChange={(event) => setAppleMusicUrl(event.target.value)} placeholder="https://music.apple.com/us/playlist/…" aria-describedby="party-playlist-help" />
          <span id="party-playlist-help" className="text-xs font-normal text-muted-foreground">Paste a public playlist link. Its cover and player appear automatically.</span>
          {appleMusicUrl.trim() && !getAppleMusicPlaylist(appleMusicUrl) ? <span role="status" className="text-xs text-destructive">Paste a public Apple Music playlist link.</span> : null}
        </label>
</div><div hidden={audioService !== "spotify"}>        <label className="grid min-w-0 gap-2 text-sm font-medium">Spotify playlist <span className="text-xs font-normal text-muted-foreground">Optional</span>
          <Input name="spotifyUrl" type="url" maxLength={2048} value={spotifyUrl} onChange={(event) => setSpotifyUrl(event.target.value)} placeholder="https://open.spotify.com/playlist/…" />
          {spotifyUrl.trim() && !getSpotifyPlaylist(spotifyUrl) ? <span role="status" className="text-xs text-destructive">Paste a public Spotify playlist link.</span> : null}
        </label>
</div>
        </section>
        <section aria-label="Invitation" className="grid gap-4 rounded-2xl border bg-white p-4">
          <h2 className="text-lg font-semibold">Invitation</h2>
          <label className="grid gap-2 text-sm font-medium">Choose your invitation service<PartySelect label="Invitation service" value={invitationService} onChange={setInvitationService} placeholder="Select Partiful or Luma" options={[{value: "partiful", label: "Partiful"}, {value: "luma", label: "Luma"}]} /></label>
          <div hidden={!invitationService} className="space-y-2"><label className="grid gap-2 text-sm font-medium">{invitationService === "luma" ? "Luma event link" : "Partiful invitation link"}<Input name="partyfulUrl" type="url" maxLength={2048} value={partyfulUrl} onChange={event => setPartyfulUrl(event.target.value)} placeholder={invitationService === "luma" ? "https://luma.com/your-event" : "https://partiful.com/e/…"} /></label>
          {partyfulUrl.trim() && !getPartyInvitation(partyfulUrl) ? <p role="status" className="text-xs text-destructive">Paste a valid Partiful or Luma event link.</p> : null}
          <p className="text-xs leading-5 text-muted-foreground">Add a public event link. Guest lists and RSVP details aren’t imported.</p></div>
        </section>
      </div>
          </div>

        <section hidden={step !== 4} data-party-step="vendors" ref={tagPanelRef} className="space-y-5 rounded-2xl border border-[#e8b4bb] bg-[#fff0f2] p-5">
          <div><h2 className="text-xl font-semibold text-[#994458]">Give your vendors credit</h2><p className="mt-2 text-sm leading-6 text-[#875d66]">Tag the vendors who made your party special. Help others discover their work and bring them more business!!</p></div>
          {step === 4 && !taggingOpen ? photoTagger : null}
        </section>

        </div>
      </div>
      {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
      <Dialog.Root open={taggingOpen && step === 4} onOpenChange={setTaggingOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/25 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-x-3 top-1/2 z-[81] max-h-[80dvh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#e8b4bb] bg-white p-5 shadow-xl sm:inset-x-auto sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2">
            <div className="mb-4 flex items-center justify-between gap-3"><Dialog.Title className="font-semibold">Tag vendors</Dialog.Title><Dialog.Close asChild><Button type="button" variant="ghost" size="icon" aria-label="Close vendor tagging"><X className="h-4 w-4" /></Button></Dialog.Close></div>
            <Dialog.Description className="mb-4 text-sm text-muted-foreground">Search for the vendor who helped create this moment.</Dialog.Description>
            {photoTagger}
            <Dialog.Close asChild><Button type="button" className="mt-4 w-full">Done</Button></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {editingCropPhoto ? (
        <PartyPhotoEditor
          aspectLabel={editingCover ? "Edit cover photo" : "Edit party photo"}
          crop={editingCropPhoto.crop}
          imageUrl={editingCropPhoto.url}
          onCancel={() => { setEditingCropPhoto(null); setEditingCover(false); }}
          onSave={(crop) => {
            setPhotoCrop(editingCropPhoto.id, crop);
            if (editingCover) setCoverPhoto(editingCropPhoto.id);
            setSelectedPhotoId(editingCropPhoto.id);
            setStep(1);
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
  const [addingCollaborator, setAddingCollaborator] = useState(false);
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
    <section className="grid min-w-0 gap-3">
      {!guestMode ? <p className="text-sm font-medium">Hosted by</p> : null}

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
          <PartySelect label="Choose party host" value={mainHostId} onChange={onMainHostChange} options={users.map(user => ({value: user.id, label: `${getUserDisplayName(user)} ${user.username ? `(@${user.username})` : ""}`}))} />
          </details>
        </div>
      </div> : null}

      <div>
        <Button type="button" variant="ghost" aria-expanded={addingCollaborator} onClick={() => setAddingCollaborator(!addingCollaborator)} className="px-0 text-sm font-medium"><Plus className="h-4 w-4" />{guestMode ? "Add guest" : "Add co-host"}</Button>
        <div hidden={!addingCollaborator} className={addingCollaborator ? "mt-3 grid min-w-0 gap-2" : "hidden"}>
        <label className="sr-only" htmlFor={guestMode ? "party-guests" : "party-cohosts"}>{guestMode ? "Add guests" : "Add co-hosts"}</label>
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

function PhotoVendorTagger({
  partyVendorRatings,
  currentUserId,
  onAddVendor,
  onContributionChange,
  onRatingChange,
  onCreateVendor,
  onRemoveVendor,
  onSocialsUpdated,
  photo,
  vendors
}: {
  currentUserId: string;
  onAddVendor: (vendorId: string) => void;
  onContributionChange: (vendorId: string, contribution: string) => void;
  partyVendorRatings: Record<string, number>;
  onRatingChange: (vendorId: string, rating: number) => void;
  onCreateVendor: (initialName: string) => void;
  onSocialsUpdated: (vendorId: string, socials: { instagramUrl: string | null; tiktokUrl: string | null; website: string | null }) => void;
  onRemoveVendor: (vendorId: string) => void;
  photo: UploadedPartyPhoto;
  vendors: VendorOption[];
}) {
  const [editingRating, setEditingRating] = useState<string | null>(null);
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
        <span className="block truncate text-sm font-semibold text-foreground">Add vendor or store</span>
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
          aria-label="Search vendors"
          autoFocus
          placeholder="Search vendors, stores, or usernames"
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
              {vendor.status === "UNCLAIMED" ? <UnclaimedVendorSocialEditor key={vendor.id} vendor={vendor} photoId={photo.id} onSaved={(socials) => onSocialsUpdated(vendor.id, socials)} /> : null}
              <VendorFollowPrompt vendor={vendor} currentUserId={currentUserId} />
              {partyVendorRatings[vendor.id] && editingRating !== vendor.id ? <div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><span>Your rating: {partyVendorRatings[vendor.id]} / 5 · once per party</span><button type="button" className="text-primary underline" onClick={() => setEditingRating(vendor.id)}>Edit rating</button></div> : <fieldset className="mt-4">
                <legend className="text-sm font-semibold">How was your experience with {vendor.name}?</legend>
                <p className="mt-1 text-xs text-muted-foreground">Required once per party · your rating applies to every photo you tag.</p>
                <div className="mt-2 flex gap-1" role="radiogroup" aria-label={`Rate ${vendor.name}`}>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button key={rating} type="button" role="radio" aria-checked={(partyVendorRatings[vendor.id] ?? 0) === rating}
                      aria-label={`${rating} star${rating === 1 ? "" : "s"}`} onClick={() => { onRatingChange(vendor.id, rating); setEditingRating(null); }}
                      className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2">
                      <Star className={`h-6 w-6 ${(partyVendorRatings[vendor.id] ?? 0) >= rating ? "fill-current" : ""}`} />
                    </button>
                  ))}
                </div>
              </fieldset>}
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
