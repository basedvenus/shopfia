"use client";

import { ChangeEvent, useEffect, useState } from "react";
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
  name: string;
  label: string;
  changeLabel?: string;
  cropName?: string;
  defaultCrop?: ImageCrop | null;
  defaultValue?: string | null;
  helperText?: string;
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
  changeLabel = "Change image",
  cropName,
  defaultCrop,
  name,
  label,
  defaultValue,
  helperText,
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
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [internalCrop, setInternalCrop] = useState<ImageCrop>(() => normalizeImageCrop(defaultCrop));
  const [uploadPreviewValue, setUploadPreviewValue] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [failedUpload, setFailedUpload] = useState<{
    crop: ImageCrop;
    file: File;
    preview: string;
  } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isRound = rounded === "full";
  const value = controlledValue !== undefined ? controlledValue ?? "" : internalValue;
  const crop = valueCrop ? normalizeImageCrop(valueCrop) : internalCrop;
  const previewValue = uploadPreviewValue ?? value;
  const resolvedCropName = cropName ?? `${name}Crop`;

  useEffect(() => {
    setInternalCrop(normalizeImageCrop(defaultCrop));
  }, [defaultCrop]);

  function updateValue(nextValue: string) {
    setInternalValue(nextValue);
    setUploadPreviewValue(null);
    onChangePreview?.(nextValue);
  }

  function updateCrop(nextCrop: ImageCrop) {
    const normalized = normalizeImageCrop(nextCrop);
    setInternalCrop(normalized);
    onCropChange?.(normalized);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);

    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      setMessage(`Choose a supported image file: ${SUPPORTED_IMAGE_FORMAT_LABEL}.`);
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setMessage(`Choose an image smaller than ${formatBytes(MAX_IMAGE_SIZE_BYTES)}.`);
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingPreview(localPreviewUrl);
    setFailedUpload(null);
    setEditorOpen(true);
  }

  async function saveEditedImage(nextCrop: ImageCrop) {
    if (!pendingFile || !pendingPreview) {
      updateCrop(nextCrop);
      setEditorOpen(false);
      return;
    }

    setMessage(null);
    updateCrop(nextCrop);
    setUploadPreviewValue(pendingPreview);

    const saved = uploadEndpoint
      ? await uploadEditedImage(pendingFile, nextCrop)
      : await storeOriginalImagePreview(pendingFile);

    if (saved) {
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
      const croppedFile = uploadMode === "preserve" && !isRound
        ? await resizeImageUploadFile(file, {
            maxSize: 1800,
            outputType: "image/jpeg"
          })
        : isRound
        ? await cropImageFile(file, nextCrop, {
            aspectRatio: 1,
            maxSize: 900,
            outputType: "image/jpeg"
          })
        : await cropImageFile(file, nextCrop, {
            aspectRatio: 4 / 3,
            maxSize: 1600,
            outputType: "image/jpeg"
          });
      const uploadData = new FormData();
      uploadData.set("file", croppedFile);
      uploadData.set("crop", JSON.stringify(DEFAULT_IMAGE_CROP));
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
      updateCrop(DEFAULT_IMAGE_CROP);
      onUploadComplete?.(result);
      setMessage(
        result.persisted
          ? "Photo uploaded and saved."
          : "Photo uploaded. Save draft or publish to keep it on this storefront."
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
      setMessage("Image added. Save draft or publish to keep it.");
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
    setInternalCrop(normalizeImageCrop(failedUpload.crop));
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
      <label className="text-sm font-medium">{label}</label>
      <label
        className={`group relative grid cursor-pointer place-items-center overflow-hidden border border-dashed border-border bg-white/80 text-center text-sm text-muted-foreground transition hover:border-primary ${
          isRound ? "h-32 w-32 rounded-full" : "min-h-[150px] rounded-[1.5rem]"
        }`}
      >
        {previewValue ? (
          <CroppedImage
            src={previewValue}
            alt=""
            crop={crop}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : null}
        <span className="relative z-10 rounded-full bg-white/90 px-3 py-1.5 shadow-sm">
          {previewValue ? changeLabel : uploadLabel}
        </span>
        <input type="file" accept={SUPPORTED_IMAGE_TYPES.join(",")} className="sr-only" onChange={handleFile} />
      </label>
      <input type="hidden" name={name} value={value} />
      <input type="hidden" name={resolvedCropName} value={JSON.stringify(crop)} />
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      <p className="text-xs text-muted-foreground">
        Supported formats: {SUPPORTED_IMAGE_FORMAT_LABEL}. Max size: {formatBytes(MAX_IMAGE_SIZE_BYTES)}.
      </p>
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
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
          aspectLabel={isRound ? "Profile crop" : uploadMode === "preserve" ? "Image preview" : "Image crop"}
          crop={crop}
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
  const sourceImage = await loadImage(objectUrl);
  const canvas = document.createElement("canvas");

  try {
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
  const sourceImage = await loadImage(objectUrl);
  const canvas = document.createElement("canvas");

  try {
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
  const sourceImage = await loadImage(objectUrl);
  const canvas = document.createElement("canvas");

  try {
    const normalized = normalizeImageCrop(crop);
    const visibleScale = Math.max(1, normalized.zoom);
    let sourceWidth = sourceImage.naturalWidth / visibleScale;
    let sourceHeight = sourceWidth / options.aspectRatio;

    if (sourceHeight > sourceImage.naturalHeight / visibleScale) {
      sourceHeight = sourceImage.naturalHeight / visibleScale;
      sourceWidth = sourceHeight * options.aspectRatio;
    }

    sourceWidth = Math.min(sourceWidth, sourceImage.naturalWidth);
    sourceHeight = Math.min(sourceHeight, sourceImage.naturalHeight);

    const centerX = (sourceImage.naturalWidth * normalized.x) / 100;
    const centerY = (sourceImage.naturalHeight * normalized.y) / 100;
    const sourceX = clamp(centerX - sourceWidth / 2, 0, sourceImage.naturalWidth - sourceWidth);
    const sourceY = clamp(centerY - sourceHeight / 2, 0, sourceImage.naturalHeight - sourceHeight);

    const outputWidth = Math.max(1, Math.min(options.maxSize, Math.round(sourceWidth)));
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

    context.drawImage(
      sourceImage,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputWidth,
      outputHeight
    );

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

function clamp(value: number, min: number, max: number) {
  if (max <= min) return min;
  return Math.min(max, Math.max(min, value));
}
