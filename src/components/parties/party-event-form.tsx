"use client";

import { useRef, useState, useTransition, type DragEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Star, Upload, X } from "lucide-react";
import { createPartyEventAction, updatePartyEventAction } from "@/app/actions/auth";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type VendorOption = {
  id: string;
  name: string;
  city: string;
  state: string | null;
};

type UploadedPartyPhoto = {
  id: string;
  url: string;
  vendorIds: string[];
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

  function togglePhotoVendor(photoId: string, vendorId: string) {
    setPhotos((current) =>
      current.map((photo) => {
        if (photo.id !== photoId) return photo;
        const hasVendor = photo.vendorIds.includes(vendorId);
        return {
          ...photo,
          vendorIds: hasVendor
            ? photo.vendorIds.filter((id) => id !== vendorId)
            : [...photo.vendorIds, vendorId]
        };
      })
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
        formData.set("photos", JSON.stringify(photos.map(({ id, vendorIds }) => ({ id, vendorIds }))));

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
                  <img src={photo.url} alt="" className="h-full w-full object-cover object-center" />
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
                  <div className="flex flex-wrap gap-2">
                    {vendors.length > 0 ? (
                      vendors.map((vendor) => {
                        const selected = photo.vendorIds.includes(vendor.id);
                        return (
                          <button
                            key={vendor.id}
                            type="button"
                            onClick={() => togglePhotoVendor(photo.id, vendor.id)}
                            className={`rounded-full border px-3 py-1.5 text-xs transition ${
                              selected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-white text-muted-foreground hover:border-primary/60"
                            }`}
                          >
                            {vendor.name}
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted-foreground">Verified vendors will appear here as tag options.</p>
                    )}
                  </div>
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
    vendorIds: []
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
