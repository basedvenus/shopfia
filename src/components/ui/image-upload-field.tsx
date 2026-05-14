"use client";

import { ChangeEvent, useState } from "react";
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
  defaultValue?: string | null;
  helperText?: string;
  onChangePreview?: (value: string) => void;
  onUploadComplete?: (result: UploadResult) => void;
  rounded?: "full" | "large";
  uploadEndpoint?: string;
  uploadLabel?: string;
  value?: string | null;
};

export function ImageUploadField({
  changeLabel = "Change image",
  name,
  label,
  defaultValue,
  helperText,
  onChangePreview,
  onUploadComplete,
  rounded = "large",
  uploadEndpoint,
  uploadLabel = "Upload image",
  value: controlledValue
}: ImageUploadFieldProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [uploadPreviewValue, setUploadPreviewValue] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isRound = rounded === "full";
  const value = controlledValue !== undefined ? controlledValue ?? "" : internalValue;
  const previewValue = uploadPreviewValue ?? value;

  function updateValue(nextValue: string) {
    setInternalValue(nextValue);
    setUploadPreviewValue(null);
    onChangePreview?.(nextValue);
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

    if (uploadEndpoint) {
      const localPreviewUrl = URL.createObjectURL(file);
      setUploadPreviewValue(localPreviewUrl);

      try {
        const uploadData = new FormData();
        uploadData.set("file", file);
        const response = await fetch(uploadEndpoint, {
          method: "POST",
          body: uploadData
        });
        const result = (await response.json()) as UploadResult;

        if (!response.ok || !result.url) {
          throw new Error(result.error ?? "Upload failed.");
        }

        console.log("[profile] upload response", result);
        console.log("[profile] upload handler generated URL", {
          path: result.path,
          publicUrl: result.publicUrl,
          persisted: result.persisted,
          url: result.url
        });
        updateValue(result.url);
        onUploadComplete?.(result);
        setMessage(
          result.persisted
            ? "Photo uploaded and saved to your profile."
            : "Photo uploaded, but persistence was not confirmed."
        );
      } catch (error) {
        setUploadPreviewValue(null);
        onChangePreview?.(value);
        setMessage(error instanceof Error ? error.message : "That image could not be uploaded.");
      } finally {
        URL.revokeObjectURL(localPreviewUrl);
      }
      return;
    }

    try {
      const nextValue = await resizeImageFile(file, isRound ? 320 : 1200, isRound);
      updateValue(nextValue);
    } catch {
      setMessage("That image could not be processed. Try a different photo.");
    }
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
          <img
            src={previewValue}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : null}
        <span className="relative z-10 rounded-full bg-white/90 px-3 py-1.5 shadow-sm">
          {previewValue ? changeLabel : uploadLabel}
        </span>
        <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
      </label>
      <input type="hidden" name={name} value={value} />
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
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

async function resizeImageFile(file: File, maxSize: number, cropSquare: boolean) {
  const objectUrl = URL.createObjectURL(file);
  const sourceImage = await loadImage(objectUrl);
  const canvas = document.createElement("canvas");

  try {
    if (cropSquare) {
      canvas.width = maxSize;
      canvas.height = maxSize;
    } else {
      const scale = Math.min(
        1,
        maxSize / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight)
      );
      canvas.width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
    }

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is unavailable.");
    }

    if (cropSquare) {
      const sourceSize = Math.min(sourceImage.naturalWidth, sourceImage.naturalHeight);
      const sourceX = Math.round((sourceImage.naturalWidth - sourceSize) / 2);
      const sourceY = Math.round((sourceImage.naturalHeight - sourceSize) / 2);
      context.drawImage(
        sourceImage,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        maxSize,
        maxSize
      );
    } else {
      context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
    }

    return canvas.toDataURL("image/jpeg", cropSquare ? 0.72 : 0.8);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
