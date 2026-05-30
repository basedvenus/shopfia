"use client";

import { useMemo, useRef, useState, useTransition, type DragEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Search, Star, Upload, X } from "lucide-react";
import { createPartyEventAction, updatePartyEventAction } from "@/app/actions/auth";
import { createUnclaimedVendorAction } from "@/app/actions/vendor";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";
import { Button } from "@/components/ui/button";
import { CroppedImage } from "@/components/ui/cropped-image";
import { ImageCropEditor } from "@/components/ui/image-crop-editor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_IMAGE_CROP, type ImageCrop } from "@/lib/image-crop";

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
  status?: "CLAIMED" | "UNCLAIMED";
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
  vendorRatings: Record<string, number>;
};

export type EditablePartyEvent = {
  id: string;
  slug: string;
  title: string;
  theme: string | null;
  tags: string[];
  description: string | null;
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
  photos: UploadedPartyPhoto[];
};

type PartyEventFormProps = {
  currentUserId: string;
  initialParty?: EditablePartyEvent | null;
  users: UserOption[];
  vendors: VendorOption[];
};

export function PartyEventForm({ currentUserId, initialParty, users, vendors }: PartyEventFormProps) {
  const isEditing = Boolean(initialParty);
  const [message, setMessage] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(() => initialParty?.tags ?? []);
  const [photos, setPhotos] = useState<UploadedPartyPhoto[]>(() => initialParty?.photos ?? []);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>(vendors);
  const [mainHostId, setMainHostId] = useState(initialParty?.mainHostId ?? currentUserId);
  const [coHostIds, setCoHostIds] = useState<string[]>(() => initialParty?.coHostIds ?? []);
  const [editingCropPhoto, setEditingCropPhoto] = useState<UploadedPartyPhoto | null>(null);
  const [newVendorModal, setNewVendorModal] = useState<{ initialName: string; photoId: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addTag(rawTag = tagInput) {
    const tag = normalizeTag(rawTag);
    if (!tag) return;
    setTags((current) => (current.includes(tag) ? current : [...current, tag].slice(0, 12)));
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((item) => item !== tag));
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;

    setMessage(null);
    setIsUploading(true);
    try {
      const uploaded: UploadedPartyPhoto[] = [];
      for (const file of files) {
        uploaded.push(await uploadPartyPhoto(file));
      }
      setPhotos((current) => [...current, ...uploaded].slice(0, 16));
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

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    void uploadFiles(event.dataTransfer.files);
  }

  function togglePhotoVendor(photoId: string, vendorId: string, forceSelected?: boolean) {
    setPhotos((current) =>
      current.map((photo) => {
        if (photo.id !== photoId) return photo;
        const hasVendor = photo.vendorIds.includes(vendorId);
        const shouldSelect = forceSelected ?? !hasVendor;
        const vendorRatings = { ...photo.vendorRatings };
        if (!shouldSelect) {
          delete vendorRatings[vendorId];
        }
        return {
          ...photo,
          vendorIds: shouldSelect
            ? hasVendor
              ? photo.vendorIds
              : [...photo.vendorIds, vendorId].slice(0, 8)
            : photo.vendorIds.filter((id) => id !== vendorId),
          vendorRatings
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

  function setPhotoVendorRating(photoId: string, vendorId: string, rating: number) {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              vendorRatings: {
                ...photo.vendorRatings,
                [vendorId]: rating
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

  function movePhoto(photoId: string, direction: -1 | 1) {
    setPhotos((current) => {
      const index = current.findIndex((photo) => photo.id === photoId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [photo] = next.splice(index, 1);
      next.splice(nextIndex, 0, photo);
      return next;
    });
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
      action={(formData) => {
        setMessage(null);
        if (initialParty) {
          formData.set("eventId", initialParty.id);
        }
        tags.forEach((tag) => formData.append("tags", tag));
        formData.set("mainHostId", mainHostId);
        coHostIds.forEach((id) => formData.append("coHostIds", id));
        formData.set(
          "photos",
          JSON.stringify(photos.map(({ crop, id, vendorIds, vendorRatings }) => ({ crop, id, vendorIds, vendorRatings })))
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
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not save party. Please try again.");
          }
        });
      }}
      className="grid gap-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          name="title"
          placeholder="Party Name, e.g. Lemon Garden Brunch"
          required
          defaultValue={initialParty?.title ?? ""}
        />
        <Input
          name="theme"
          placeholder="Theme, e.g. Citrus baby shower"
          defaultValue={initialParty?.theme ?? ""}
        />
      </div>
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
      <Textarea
        name="description"
        placeholder="Tell the party details: the mood, inspiration, favorite moments, or what made it special..."
        className="min-h-[110px]"
        defaultValue={initialParty?.description ?? ""}
      />

      <PartyCollaboratorPicker
        coHostIds={coHostIds}
        currentUserId={currentUserId}
        mainHostId={mainHostId}
        onAddCoHost={(userId) => {
          if (userId === mainHostId) return;
          setCoHostIds((current) => (current.includes(userId) ? current : [...current, userId].slice(0, 12)));
        }}
        onMainHostChange={(userId) => {
          setMainHostId(userId);
          setCoHostIds((current) => current.filter((id) => id !== userId));
        }}
        onRemoveCoHost={(userId) => setCoHostIds((current) => current.filter((id) => id !== userId))}
        users={users}
      />

      <div className="grid gap-2">
        <label className="text-sm font-medium">Hashtags</label>
        <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-2xl border bg-white px-3 py-2">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              aria-label={`Remove ${tag}`}
            >
              #{tag}
              <X className="h-3 w-3" />
            </button>
          ))}
          <input
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addTag();
              }
            }}
            onBlur={() => addTag()}
            className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder={tags.length ? "Add another tag" : "baby shower, brunch, pastel..."}
          />
        </div>
        <p className="text-xs text-muted-foreground">Press Enter to turn each tag into a searchable bubble.</p>
      </div>

      <div className="grid gap-3">
        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className="grid min-h-[180px] cursor-pointer place-items-center rounded-[1.5rem] border border-dashed border-primary/40 bg-white/80 p-5 text-center transition hover:border-primary hover:bg-primary/5"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) {
                void uploadFiles(event.target.files);
              }
            }}
          />
          <span className="grid gap-3 justify-items-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            </span>
            <span className="font-semibold">{isUploading ? "Uploading photos..." : "Drag photos here or click to upload"}</span>
            <span className="max-w-sm text-xs leading-5 text-muted-foreground">
              First photo is the cover. Reorder anytime, then tag vendors on each image.
            </span>
          </span>
        </label>

        {photos.length > 0 ? (
          <div className="grid gap-3">
            {photos.map((photo, index) => (
              <article key={photo.id} className="grid gap-3 rounded-[1.4rem] border bg-white p-3 sm:grid-cols-[150px_1fr]">
                <div className="relative aspect-square overflow-hidden rounded-[1rem] bg-muted">
                  <CroppedImage src={photo.url} alt="" crop={photo.crop} className="h-full w-full object-cover object-center" />
                  {index === 0 ? (
                    <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium shadow-sm">
                      Cover
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">Photo {index + 1}</p>
                      <p className="text-xs text-muted-foreground">Tag vendors for this specific image.</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {index > 0 ? (
                        <IconButton label="Make cover" onClick={() => setCoverPhoto(photo.id)}>
                          <Star className="h-4 w-4" />
                        </IconButton>
                      ) : null}
                      <IconButton label="Reposition photo" onClick={() => setEditingCropPhoto(photo)}>
                        <ImagePlus className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Move up" disabled={index === 0} onClick={() => movePhoto(photo.id, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Move down" disabled={index === photos.length - 1} onClick={() => movePhoto(photo.id, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Remove photo" onClick={() => removePhoto(photo.id)}>
                        <X className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                  <PhotoVendorTagger
                    onAddVendor={(vendorId) => togglePhotoVendor(photo.id, vendorId, true)}
                    onCreateVendor={(initialName) => setNewVendorModal({ initialName, photoId: photo.id })}
                    onRateVendor={(vendorId, rating) => setPhotoVendorRating(photo.id, vendorId, rating)}
                    onRemoveVendor={(vendorId) => togglePhotoVendor(photo.id, vendorId, false)}
                    photo={photo}
                    vendors={vendorOptions}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-[1.2rem] bg-muted/60 p-3 text-sm text-muted-foreground">
            <ImagePlus className="h-4 w-4" />
            Uploaded party photos will preview here.
          </div>
        )}
      </div>

      <Button type="submit" disabled={isPending || isUploading || (!isEditing && photos.length === 0)}>
        {isPending ? "Saving..." : isEditing ? "Save changes" : "Add Party"}
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {editingCropPhoto ? (
        <ImageCropEditor
          aspectLabel="Party photo crop"
          crop={editingCropPhoto.crop}
          imageUrl={editingCropPhoto.url}
          onCancel={() => setEditingCropPhoto(null)}
          onSave={(crop) => {
            setPhotoCrop(editingCropPhoto.id, crop);
            setEditingCropPhoto(null);
          }}
          previewClassName="aspect-[4/3]"
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
  "Balloons",
  "Cakes & Desserts",
  "Florals",
  "Children's Entertainment",
  "Event Rentals",
  "Photography",
  "Catering",
  "Venue",
  "Entertainment",
  "Decor",
  "Other"
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
  const [category, setCategory] = useState<(typeof UNCLAIMED_VENDOR_CATEGORIES)[number]>("Other");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
          <label className="grid gap-1.5 text-sm font-semibold">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof UNCLAIMED_VENDOR_CATEGORIES)[number])}
              className="h-11 rounded-[1rem] border border-input bg-white px-3 text-sm outline-none focus:border-primary/45 focus:ring-2 focus:ring-primary/15"
              required
            >
              {UNCLAIMED_VENDOR_CATEGORIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
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
                const result = await createUnclaimedVendorAction({ category, instagramHandle, name, website });
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
  coHostIds,
  currentUserId,
  mainHostId,
  onAddCoHost,
  onMainHostChange,
  onRemoveCoHost,
  users
}: {
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
  const selectedIds = new Set([mainHostId, ...coHostIds]);
  const matches = users
    .filter((user) => {
      if (selectedIds.has(user.id)) return false;
      const haystack = `${user.name ?? ""} ${user.username ?? ""}`.toLowerCase();
      return query.trim() ? haystack.includes(query.trim().toLowerCase()) : user.id !== currentUserId;
    })
    .slice(0, 6);

  return (
    <section className="grid gap-3 rounded-[1.5rem] border bg-white p-4">
      <div>
        <p className="text-sm font-semibold">Party hosts</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Add friends or creators who helped host this party. Co-hosts appear after they accept.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">Main Host</label>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-3 rounded-2xl border bg-[#fffaf8] px-3 py-2">
            {mainHost ? <UserAvatar user={mainHost} /> : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{getUserDisplayName(mainHost)}</p>
              <p className="truncate text-xs text-muted-foreground">{getUserHandle(mainHost)}</p>
            </div>
          </div>
          <select
            value={mainHostId}
            onChange={(event) => onMainHostChange(event.target.value)}
            className="h-12 rounded-2xl border bg-white px-3 text-sm outline-none transition focus:border-primary"
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {getUserDisplayName(user)} {user.username ? `(@${user.username})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">Supporting Hosts / Co-Hosts</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
            placeholder="Search friends or usernames"
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
          <p className="text-xs text-muted-foreground">Optional. Co-hosts can accept before appearing publicly.</p>
        )}
      </div>
    </section>
  );
}

function UserAvatar({ size = "md", user }: { size?: "sm" | "md"; user?: UserOption }) {
  const className = size === "sm" ? "h-5 w-5 text-[10px]" : "h-9 w-9 text-xs";
  if (user?.image) {
    return <img src={user.image} alt="" className={`${className} shrink-0 rounded-full object-cover`} />;
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
  onAddVendor,
  onCreateVendor,
  onRateVendor,
  onRemoveVendor,
  photo,
  vendors
}: {
  onAddVendor: (vendorId: string) => void;
  onCreateVendor: (initialName: string) => void;
  onRateVendor: (vendorId: string, rating: number) => void;
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
                        {vendor.status === "UNCLAIMED" ? "Unclaimed business" : vendor.username ? `@${vendor.username}` : "Vendor profile"}
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
                      {vendor.status === "UNCLAIMED" ? "Unclaimed business" : vendor.username ? `@${vendor.username}` : "Tagged vendor"}
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
              <div className="mt-3 flex items-center gap-1.5">
                <span className="mr-1 text-xs text-muted-foreground">Rate</span>
                {[1, 2, 3, 4, 5].map((rating) => {
                  const selected = (photo.vendorRatings[vendor.id] ?? 0) >= rating;
                  return (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => onRateVendor(vendor.id, rating)}
                      className={`transition ${selected ? "text-primary" : "text-[#d8c7c2] hover:text-primary/70"}`}
                      aria-label={`Rate ${vendor.name} ${rating} star${rating === 1 ? "" : "s"}`}
                    >
                      <Star className={`h-4 w-4 ${selected ? "fill-current" : ""}`} />
                    </button>
                  );
                })}
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
  if (vendor.logoUrl) {
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

function normalizeTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
}
