"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { CroppedImage } from "@/components/ui/cropped-image";
import { ImageCropEditor } from "@/components/ui/image-crop-editor";
import { DEFAULT_IMAGE_CROP, normalizeImageCrop, type ImageCrop } from "@/lib/image-crop";
import type { SharedUserProfile } from "@/lib/user-profile";

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

    if (!file.type.startsWith("image/")) {
      setMessage("Choose an image file.");
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingPreview(localPreviewUrl);
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

    if (uploadEndpoint) {
      await uploadOriginalImage(pendingFile, nextCrop);
    } else {
      await storeOriginalImagePreview(pendingFile);
    }

    URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
    setEditorOpen(false);
  }

  async function uploadOriginalImage(file: File, nextCrop: ImageCrop) {
    try {
      const uploadData = new FormData();
      uploadData.set("file", file);
      uploadData.set("crop", JSON.stringify(nextCrop));
      const response = await fetch(uploadEndpoint!, {
        method: "POST",
        body: uploadData
      });
      const result = (await response.json()) as UploadResult;

      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Upload failed.");
      }

      updateValue(result.url);
      onUploadComplete?.(result);
      setMessage(
        result.persisted
          ? "Photo uploaded and saved."
          : "Photo uploaded. Positioning will save with this form."
      );
    } catch (error) {
      setUploadPreviewValue(null);
      onChangePreview?.(value);
      setMessage(error instanceof Error ? error.message : "That image could not be uploaded.");
    }
  }

  async function storeOriginalImagePreview(file: File) {
    try {
      const nextValue = await resizeImageFile(file, isRound ? 900 : 1600);
      updateValue(nextValue);
      setMessage("Image added. Positioning will save with this form.");
    } catch {
      setUploadPreviewValue(null);
      setMessage("That image could not be processed. Try a different photo.");
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
        <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
      </label>
      <input type="hidden" name={name} value={value} />
      <input type="hidden" name={resolvedCropName} value={JSON.stringify(crop)} />
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
      {editorOpen && pendingPreview ? (
        <ImageCropEditor
          aspectLabel={isRound ? "Profile crop" : "Image crop"}
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
