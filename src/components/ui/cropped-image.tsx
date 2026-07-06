import { imageCropToCss, type ImageCrop } from "@/lib/image-crop";

type CroppedImageProps = {
  alt?: string;
  className?: string;
  crop?: ImageCrop | null;
  decoding?: "async" | "auto" | "sync";
  loading?: "eager" | "lazy";
  src: string;
};

export function CroppedImage({
  alt = "",
  className,
  crop,
  decoding = "async",
  loading = "lazy",
  src
}: CroppedImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      decoding={decoding}
      loading={loading}
      className={className}
      style={{
        ...imageCropToCss(crop),
        transformOrigin: `${crop?.x ?? 50}% ${crop?.y ?? 50}%`
      }}
    />
  );
}
