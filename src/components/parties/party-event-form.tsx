"use client";

import { useMemo, useRef, useState, useTransition, type DragEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Search, Star, Upload, X } from "lucide-react";
import { createPartyEventAction, updatePartyEventAction } from "@/app/actions/auth";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";
import { Button } from "@/components/ui/button";
import { CroppedImage } from "@/components/ui/cropped-image";
import { ImageCropEditor } from "@/components/ui/image-crop-editor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_IMAGE_CROP, type ImageCrop } from "@/lib/image-crop";

type VendorOption = {
  id: string;
  name: string;
  username: string | null;
  city: string;
  state: string | null;
  logoUrl: string | null;
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
  photos: UploadedPartyPhoto[];
};

type PartyEventFormProps = {
  initialParty?: EditablePartyEvent | null;
  vendors: VendorOption[];
};

export function PartyEventForm({ initialParty, vendors }: PartyEventFormProps) {
  const isEditing = Boolean(initialParty);
  const [message, setMessage] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(() => initialParty?.tags ?? []);
  const [photos, setPhotos] = useState<UploadedPartyPhoto[]>(() => initialParty?.photos ?? []);
  const [editingCropPhoto, setEditingCropPhoto] = useState<UploadedPartyPhoto | null>(null);
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
      const uploaded = await Promise.all(files.map(uploadPartyPhoto));
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
        formData.set(
          "photos",
          JSON.stringify(photos.map(({ crop, id, vendorIds, vendorRatings }) => ({ crop, id, vendorIds, vendorRatings })))
        );

        startTransition(async () => {
          const result = initialParty
            ? await updatePartyEventAction(formData)
            : await createPartyEventAction(formData);
          if (!result.ok) {
            setMessage(result.error ?? "Could not save party story.");
            return;
          }
          window.location.href = `/events/${result.eventSlug}`;
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
        placeholder="Tell the party story: the mood, inspiration, favorite details, or what made it special..."
        className="min-h-[110px]"
        defaultValue={initialParty?.description ?? ""}
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
                    onRateVendor={(vendorId, rating) => setPhotoVendorRating(photo.id, vendorId, rating)}
                    onRemoveVendor={(vendorId) => togglePhotoVendor(photo.id, vendorId, false)}
                    photo={photo}
                    vendors={vendors}
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

function PhotoVendorTagger({
  onAddVendor,
  onRateVendor,
  onRemoveVendor,
  photo,
  vendors
}: {
  onAddVendor: (vendorId: string) => void;
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
  const showDropdown = isFocused && (query.trim().length > 0 || matches.length > 0);

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
            {matches.length > 0 ? (
              matches.map((vendor) => (
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
                      {vendor.username ? `@${vendor.username}` : "Vendor profile"}
                      {vendor.city ? ` · ${vendor.city}${vendor.state ? `, ${vendor.state}` : ""}` : ""}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-muted-foreground">No vendors found.</div>
            )}
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
                      {vendor.username ? `@${vendor.username}` : "Tagged vendor"}
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
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/uploads/party-photo", {
    method: "POST",
    body: formData
  });
  const result = (await response.json()) as {
    error?: string;
    photo?: { id: string; url: string };
  };

  if (!response.ok || !result.photo) {
    throw new Error(result.error ?? "That photo could not be uploaded.");
  }

  return {
    ...result.photo,
    crop: DEFAULT_IMAGE_CROP,
    vendorIds: [],
    vendorRatings: {}
  };
}

function normalizeTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
}
