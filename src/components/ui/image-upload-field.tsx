"use client";

import { getProfilePhotoType, MAX_PROFILE_PHOTO_SOURCE_BYTES } from "@/lib/profile-photo-file";
import {cropImageRect} from "@/lib/image-crop";

import { CheckCircle2, Pencil, Plus } from "lucide-react";

import { ChangeEvent, useEffect, useState, useRef } from "react";
import { CroppedImage } from "@/components/ui/cropped-image";
import { ImageCropEditor } from "@/components/ui/image-crop-editor";
import { DEFAULT_IMAGE_CROP, normalizeImageCrop, type ImageCrop } from "@/lib/image-crop";
import type { SharedUserProfile } from "@/lib/user-profile";

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SUPPORTED_IMAGE_FORMAT_LABEL = "JPG, PNG, or WebP";
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

type UploadResult = {
  error?: string;
  path?: string;
  persisted?: boolean;
  profile?: SharedUserProfile;
  publicUrl?: string;
  url?: string;
};

type ImageUploadFieldProps = {
  compact?: boolean;
  editMenu?: boolean;
  hideLabel?: boolean;
  avatarAppearance?: { initials: string; displayName: string };
  name: string;
  label: string;
  changeLabel?: string;
  cropName?: string;
  defaultCrop?: ImageCrop | null;
  defaultValue?: string | null;
  helperText?: string;
  hideFormatDetailsUntilInteraction?: boolean;
  onChangePreview?: (value: string) => void;
  onCropChange?: (crop: ImageCrop) => void;
  onUploadComplete?: (result: UploadResult) => void;
  rounded?: "full" | "large";
  uploadMode?: "crop" | "preserve";
  uploadEndpoint?: string;
  uploadLabel?: string;
  value?: string | null;
  valueCrop?: ImageCrop | null;
};

export function ImageUploadField({
  compact = false,
  editMenu = false,
  hideLabel = false,
  avatarAppearance,
  changeLabel = "Change image",
  cropName,
  defaultCrop,
  name,
  label,
  defaultValue,
  helperText,
  hideFormatDetailsUntilInteraction = false,
  onChangePreview,
  onCropChange,
  onUploadComplete,
  rounded = "large",
  uploadMode = "crop",
  uploadEndpoint,
  uploadLabel = "Upload image",
  value: controlledValue,
  valueCrop
}: ImageUploadFieldProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [uploadInteracted, setUploadInteracted] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const menuContainer = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menuContainer.current?.contains(event.target)) setMenuOpen(false);
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuTrigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [menuOpen]);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [liveCrop, setLiveCrop] = useState<ImageCrop>(() => normalizeImageCrop(valueCrop ?? defaultCrop));
  const [uploadPreviewValue, setUploadPreviewValue] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [failedUpload, setFailedUpload] = useState<{
    crop: ImageCrop;
    file: File;
    preview: string;
  } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [message, setMessageValue] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"success" | "error">("error");
  function setMessage(value: string | null, kind: "success" | "error" = "error") {
    setMessageValue(value);
    setMessageKind(kind);
  }
  const [failedPreview, setFailedPreview] = useState<string | null>(null);
  const isRound = rounded === "full";
  const value = controlledValue !== undefined ? controlledValue ?? "" : internalValue;
  const crop = liveCrop;
  const previewValue = uploadPreviewValue ?? value;
  const resolvedCropName = cropName ?? `${name}Crop`;

  useEffect(() => {
    const nextCrop = normalizeImageCrop(valueCrop ?? defaultCrop);
    setLiveCrop(nextCrop);
  }, [defaultCrop, valueCrop]);

  function updateValue(nextValue: string) {
    setInternalValue(nextValue);
    setUploadPreviewValue(null);
    onChangePreview?.(nextValue);
  }

  function updateCrop(nextCrop: ImageCrop) {
    const normalized = normalizeImageCrop(nextCrop);
    setLiveCrop(normalized);
    onCropChange?.(normalized);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    let file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);

    const profileType = isRound ? getProfilePhotoType(file) : null;
    if (isRound ? !profileType : !SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      setMessage(`Choose a supported image file: ${SUPPORTED_IMAGE_FORMAT_LABEL}.`);
      return;
    }

    const sourceLimit = isRound ? MAX_PROFILE_PHOTO_SOURCE_BYTES : MAX_IMAGE_SIZE_BYTES;
    if (file.size > sourceLimit) {
      setMessage(`Choose an image smaller than ${formatBytes(sourceLimit)}.`);
      return;
    }

    if (isRound) {
      setIsPreparing(true);
      try {
        // Convert phone formats and resize before opening the crop dialog.
        // The server continues to receive a small, signature-verified JPEG.
        const typedFile = file.type === profileType ? file : new File([file], file.name, {type:profileType!});
        file = await resizeImageUploadFile(typedFile, {maxSize:1200, outputType:"image/jpeg"});
      } catch {
        setMessage("This photo could not be opened on this device. Try a JPG, PNG, or WebP photo instead.");
        return;
      } finally {
        setIsPreparing(false);
      }
    }
    const localPreviewUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingPreview(localPreviewUrl);
    setFailedUpload(null);
    setEditorOpen(true);
  }

  async function saveEditedImage(nextCrop: ImageCrop) {
    if (!pendingFile || !pendingPreview) {
      if (isRound && uploadEndpoint === "/api/uploads/avatar") {
        try {
          const response = await fetch(uploadEndpoint, {method:"PATCH", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body:JSON.stringify({image:value,crop:nextCrop})});
          const result = await response.json() as UploadResult;
          if (!response.ok || !result.profile) throw new Error(result.error ?? "Could not save the crop.");
          updateCrop(result.profile.imageCrop as ImageCrop);
          onUploadComplete?.(result);
          setMessage("Profile crop saved.", "success");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Could not save the crop. Please try again.");
          return;
        }
      } else {
        updateCrop(nextCrop);
        setMessage("Photo adjusted. Save your changes to keep this crop.", "success");
      }
      setEditorOpen(false);
      setPendingPreview(null);
      return;
    }

    setMessage(null);
    setUploadPreviewValue(pendingPreview);

    const saved = uploadEndpoint
      ? await uploadEditedImage(pendingFile, nextCrop)
      : await storeOriginalImagePreview(pendingFile);

    if (saved) {
      if (!uploadEndpoint) updateCrop(nextCrop);
      URL.revokeObjectURL(pendingPreview);
      setPendingFile(null);
      setPendingPreview(null);
      setFailedUpload(null);
      setEditorOpen(false);
    } else {
      setFailedUpload({ crop: nextCrop, file: pendingFile, preview: pendingPreview });
      setPendingFile(null);
      setPendingPreview(null);
      setEditorOpen(false);
    }
  }

  async function uploadEditedImage(file: File, nextCrop: ImageCrop) {
    try {
      const shouldPreserveCrop = uploadMode === "preserve" || isRound;
      const uploadedFile = shouldPreserveCrop
        ? await resizeImageUploadFile(file, {
            maxSize: isRound ? 1200 : 1800,
            outputType: "image/jpeg"
          })
        : await cropImageFile(file, nextCrop, {
            aspectRatio: 4 / 3,
            maxSize: 1600,
            outputType: "image/jpeg"
          });
      const uploadData = new FormData();
      uploadData.set("file", uploadedFile);
      uploadData.set("crop", JSON.stringify(shouldPreserveCrop ? isRound ? {...nextCrop,aspectRatio:1,brightness:1,saturation:1} : nextCrop : DEFAULT_IMAGE_CROP));
      const response = await fetch(uploadEndpoint!, {
        credentials: "same-origin",
        method: "POST",
        body: uploadData
      });
      const result = (await response.json().catch(() => ({ error: "That image could not be uploaded." }))) as UploadResult;

      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Upload failed.");
      }

      updateValue(result.url);
      updateCrop(result.profile?.imageCrop as ImageCrop ?? (shouldPreserveCrop ? nextCrop : DEFAULT_IMAGE_CROP));
      onUploadComplete?.(result);
      setMessage(
        result.persisted
          ? "Photo uploaded and saved."
          : "Photo uploaded. Save draft or publish to keep it on this storefront.",
        "success"
      );
      return true;
    } catch (error) {
      setUploadPreviewValue(null);
      onChangePreview?.(value);
      setMessage(
        `${error instanceof Error ? error.message : "That image could not be uploaded."} The form will save without this image unless you retry.`
      );
      return false;
    }
  }

  async function storeOriginalImagePreview(file: File) {
    try {
      const nextValue = await resizeImageFile(file, isRound ? 900 : 1600);
      updateValue(nextValue);
      setMessage("Image added. Save draft or publish to keep it.", "success");
      return true;
    } catch {
      setUploadPreviewValue(null);
      setMessage("That image could not be processed. The form will save without this image unless you retry.");
      return false;
    }
  }

  function cancelEditor() {
    if (pendingPreview) {
      URL.revokeObjectURL(pendingPreview);
    }
    setPendingFile(null);
    setPendingPreview(null);
    setEditorOpen(false);
  }

  function retryFailedUpload() {
    if (!failedUpload) return;
    setPendingFile(failedUpload.file);
    setPendingPreview(failedUpload.preview);
    setLiveCrop(normalizeImageCrop(failedUpload.crop));
    setFailedUpload(null);
    setEditorOpen(true);
    setMessage(null);
  }

  function removeFailedUpload() {
    if (failedUpload) {
      URL.revokeObjectURL(failedUpload.preview);
    }
    setFailedUpload(null);
    setUploadPreviewValue(null);
    setMessage("Failed image removed. It will not be saved or counted.");
  }

  return (
    <div className="grid gap-2">
      <span className={avatarAppearance || hideLabel ? "sr-only" : "text-sm font-medium"}>{label}</span>
      <div ref={menuContainer} className={editMenu && (avatarAppearance || isRound) ? "group/avatar relative w-fit" : "relative w-full"}>
      <label
        className={`group relative grid cursor-pointer place-items-center overflow-hidden border border-dashed border-border bg-white/80 text-center text-sm text-muted-foreground transition hover:border-primary ${
          avatarAppearance ? "h-24 w-24 rounded-full border-4 border-solid border-white bg-accent text-2xl font-semibold text-foreground shadow-soft focus-within:ring-2 focus-within:ring-primary" : compact ? "h-24 w-24 rounded-2xl" : isRound ? "h-32 w-32 rounded-full" : "min-h-[150px] w-full rounded-[1.5rem]"
        }`}
      >
        {previewValue && failedPreview !== previewValue ? (
          <CroppedImage
            src={previewValue}
            alt={avatarAppearance?.displayName ?? ""}
            crop={crop}
            frameFit={uploadMode === "preserve" ? "contain" : "cover"}
            className="absolute inset-0 h-full w-full object-cover object-center"
            onError={() => setFailedPreview(previewValue)}
          />
        ) : null}
        {avatarAppearance && !previewValue ? <span>{avatarAppearance.initials}</span> : null}
        {!editMenu ? <span className="relative z-10 rounded-full bg-white/90 px-3 py-1.5 shadow-sm">
          {compact ? <Plus aria-hidden="true" className="h-7 w-7" /> : previewValue ? changeLabel : uploadLabel}
        </span> : null}
        <input disabled={isPreparing} aria-label={avatarAppearance ? "Change profile picture" : label || uploadLabel} onClick={() => setUploadInteracted(true)} ref={uploadInput} type="file" accept={isRound ? "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" : SUPPORTED_IMAGE_TYPES.join(",")} className={isRound ? "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" : "sr-only"} onChange={handleFile} />
      </label>
      {previewValue && onCropChange && !editMenu ? <button type="button" className="mt-2 rounded-full border px-3 py-2 text-sm" onClick={()=>{setPendingFile(null);setPendingPreview(previewValue);setEditorOpen(true);}}>Adjust image</button> : null}
      {editMenu ? <button ref={menuTrigger} disabled={isPreparing} type="button" aria-expanded={avatarAppearance ? undefined : menuOpen} aria-label={avatarAppearance ? "Change profile picture" : `Adjust ${label.toLowerCase()}`} title={avatarAppearance ? "Change profile picture" : "Adjust image"} onClick={() => { if (avatarAppearance) {setUploadInteracted(true); uploadInput.current?.click();} else setMenuOpen((open) => !open); }} className={`absolute right-0 top-0 z-10 grid h-9 w-9 place-items-center rounded-full border bg-white shadow-sm ${avatarAppearance ? "opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-within/avatar:opacity-100 [@media(hover:none)]:opacity-100" : ""}`}><Pencil className="h-4 w-4" /></button> : null}
      {editMenu && menuOpen ? <div className="absolute left-0 top-full z-20 mt-2 min-w-48 rounded-2xl border bg-white p-2 shadow-lg">
        {previewValue ? <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setPendingFile(null); setPendingPreview(previewValue); setEditorOpen(true); setMenuOpen(false); }}>{isRound ? "Crop picture" : "Adjust picture"}</button> : null}
        <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { uploadInput.current?.click(); setMenuOpen(false); }}>Change picture</button>
        <p className="px-3 py-2 text-xs text-muted-foreground">{isRound ? "JPG, PNG, WebP, HEIC, or HEIF" : SUPPORTED_IMAGE_FORMAT_LABEL}. Max size: {formatBytes(isRound ? MAX_PROFILE_PHOTO_SOURCE_BYTES : MAX_IMAGE_SIZE_BYTES)}.</p>
      </div> : null}
      </div>
      <input type="hidden" name={name} value={value} />
      <input type="hidden" name={resolvedCropName} value={JSON.stringify(crop)} />
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      {previewValue && failedPreview === previewValue ? (
        <p className="text-xs text-muted-foreground">Photo preview is unavailable. Your saved photo has not been changed.</p>
      ) : null}
      {((!editMenu && (!hideFormatDetailsUntilInteraction || uploadInteracted)) || editorOpen || pendingFile) ? <p className="text-xs text-muted-foreground">
        Supported formats: {isRound ? "JPG, PNG, WebP, HEIC, or HEIF" : SUPPORTED_IMAGE_FORMAT_LABEL}. Max size: {formatBytes(isRound ? MAX_PROFILE_PHOTO_SOURCE_BYTES : MAX_IMAGE_SIZE_BYTES)}.
      </p> : null}
      {isPreparing ? <p role="status" className="text-xs text-muted-foreground">Preparing your photo…</p> : null}
      {message ? <p role={messageKind === "success" ? "status" : "alert"} className={`flex items-center gap-1.5 text-xs ${messageKind === "success" ? "text-green-700" : "text-destructive"}`}>
        {messageKind === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}{message}
      </p> : null}
      {failedUpload ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="text-xs font-medium text-primary underline-offset-4 hover:underline" onClick={retryFailedUpload}>
            Retry
          </button>
          <button type="button" className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline" onClick={removeFailedUpload}>
            Remove
          </button>
        </div>
      ) : null}
      {editorOpen && pendingPreview ? (
        <ImageCropEditor
          allowAdjustments={editMenu && !isRound}
          preserveFrame={Boolean(onCropChange)}
          allowFrameResize={Boolean(onCropChange)&&!isRound}
          aspectLabel={isRound ? "Profile crop" : uploadMode === "preserve" ? "Image preview" : "Image crop"}
          crop={pendingFile ? DEFAULT_IMAGE_CROP : crop}
          errorMessage={messageKind === "error" ? message ?? undefined : undefined}
          imageUrl={pendingPreview}
          onCancel={cancelEditor}
          onSave={saveEditedImage}
          previewClassName={isRound ? "aspect-square max-w-[320px] rounded-full" : "aspect-[4/3]"}
        />
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb % 1 === 0 ? 0 : 1)} MB`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function resizeImageFile(file: File, maxSize: number) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const sourceImage = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      maxSize / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight)
    );
    canvas.width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is unavailable.");
    }

    context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function resizeImageUploadFile(
  file: File,
  options: { maxSize: number; outputType?: string }
) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const sourceImage = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, options.maxSize / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight));
    canvas.width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is unavailable.");
    }

    context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

    const mimeType = options.outputType ?? (SUPPORTED_IMAGE_TYPES.includes(file.type) ? file.type : "image/jpeg");
    const blob = await canvasToBlob(canvas, mimeType);
    return new File([blob], imageFileName(file.name, blob.type || mimeType), { type: blob.type || mimeType });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function cropImageFile(
  file: File,
  crop: ImageCrop,
  options: { aspectRatio: number; maxSize: number; outputType?: string }
) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const sourceImage = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    const normalized = normalizeImageCrop(crop);
    const outputWidth = Math.max(1, Math.min(options.maxSize, sourceImage.naturalWidth));
    const outputHeight = Math.max(1, Math.round(outputWidth / options.aspectRatio));
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is unavailable.");
    }

    if ((options.outputType ?? file.type) === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, outputWidth, outputHeight);
    }

    const rect=cropImageRect(sourceImage.naturalWidth,sourceImage.naturalHeight,outputWidth,outputHeight,normalized);
    context.filter=`brightness(${normalized.brightness??1}) saturate(${normalized.saturation??1})`;
    context.drawImage(sourceImage,rect.x,rect.y,rect.width,rect.height);

    const mimeType = options.outputType ?? (SUPPORTED_IMAGE_TYPES.includes(file.type) ? file.type : "image/jpeg");
    const blob = await canvasToBlob(canvas, mimeType);
    return new File([blob], imageFileName(file.name, blob.type || mimeType), { type: blob.type || mimeType });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function imageFileName(fileName: string, mimeType: string) {
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return `${fileName.replace(/\.[^.]+$/, "")}.${extension}`;
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("That image could not be processed."));
        }
      },
      mimeType,
      mimeType === "image/png" ? undefined : 0.86
    );
  });
}
