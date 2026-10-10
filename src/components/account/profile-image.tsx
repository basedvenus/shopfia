"use client";

import { useState } from "react";
import { CroppedImage } from "@/components/ui/cropped-image";
import type { ImageCrop } from "@/lib/image-crop";

export function ProfileImage({ image, crop, initials, alt = "" }: {
  image?: string | null;
  crop?: ImageCrop | null;
  initials: string;
  alt?: string;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  if (!image || failedImage === image) {
    return <span aria-label={image ? "Profile photo unavailable" : undefined}>{initials}</span>;
  }
  return (
    <CroppedImage
      src={image}
      alt={alt}
      crop={crop}
      className="block h-full w-full object-cover object-center"
      onError={() => setFailedImage(image)}
    />
  );
}
