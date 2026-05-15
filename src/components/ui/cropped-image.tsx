import { imageCropToCss, type ImageCrop } from "@/lib/image-crop";

type CroppedImageProps = {
  alt?: string;
  className?: string;
  crop?: ImageCrop | null;
  src: string;
};

export function CroppedImage({ alt = "", className, crop, src }: CroppedImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        ...imageCropToCss(crop),
        transformOrigin: `${crop?.x ?? 50}% ${crop?.y ?? 50}%`
      }}
    />
  );
}
