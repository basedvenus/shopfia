"use client";

import { useState } from "react";
import { CroppedImage } from "@/components/ui/cropped-image";
import type { ImageCrop } from "@/lib/image-crop";
import { getSafeProfileImage } from "@/lib/profile-image";

export function ProfileImage({ image, crop, initials, alt = "" }: {
  image?: string | null;
  crop?: ImageCrop | null;
  initials: string;
  alt?: string;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const safeImage = getSafeProfileImage(image);
  if (!safeImage || failedImage === safeImage) {
    return <span aria-label={safeImage ? "Profile photo unavailable" : undefined}>{initials}</span>;
  }
  return (
    <CroppedImage
      src={safeImage}
      alt={alt}
      crop={crop}
      className="block h-full w-full object-cover object-center"
      onError={() => setFailedImage(safeImage)}
    />
  );
}
