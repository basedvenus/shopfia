import { imageCropToCss, type ImageCrop } from "@/lib/image-crop";
import type { ReactEventHandler } from "react";

type CroppedImageProps = {
  alt?: string;
  className?: string;
  crop?: ImageCrop | null;
  decoding?: "async" | "auto" | "sync";
  loading?: "eager" | "lazy";
  onError?: ReactEventHandler<HTMLImageElement>;
  src: string;
};

export function CroppedImage({
  alt = "",
  className,
  crop,
  decoding = "async",
  loading = "lazy",
  onError,
  src
}: CroppedImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      decoding={decoding}
      loading={loading}
      onError={onError}
      className={className}
      style={{
        ...imageCropToCss(crop)
      }}
    />
  );
}
