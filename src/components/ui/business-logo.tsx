import { normalizeImageCrop } from "@/lib/image-crop";
import { CroppedImage } from "./cropped-image";

export function BusinessLogo({ src, alt, crop, className }: {
  src: string;
  alt: string;
  crop: unknown;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        display: "block",
        position: className?.split(/\s+/).includes("absolute") ? "absolute" : "relative",
        overflow: "hidden",
        borderRadius: "50%",
        backgroundColor: "white"
      }}
    >
      <CroppedImage
        src={src}
        alt={alt}
        crop={{ ...normalizeImageCrop(crop), aspectRatio: undefined }}
        className="absolute inset-0 h-full w-full"
      />
    </span>
  );
}
