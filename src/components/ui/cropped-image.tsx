import { normalizeImageCrop, imageCropToCss, type ImageCrop } from "@/lib/image-crop";
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
  const normalized = normalizeImageCrop(crop);
  if (normalized.aspectRatio) {
    const ratio = normalized.aspectRatio;
    // A virtual frame preserves the selected crop before fitting it to the card.
    // Different card shapes may trim the frame, but never expose excluded pixels.
    return <span className={className} style={{ display: "block", overflow: "hidden", position: /(?:^|\s)absolute(?:\s|$)/.test(className ?? "") ? "absolute" : "relative", containerType: "size" }}>
      <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: `max(100cqw, calc(100cqh * ${ratio}))`, height: `max(100cqh, calc(100cqw / ${ratio}))` }}>
        <img src={src} alt={alt} decoding={decoding} loading={loading} onError={onError} className="absolute inset-0 h-full w-full object-cover" style={imageCropToCss(normalized)} />
      </span>
    </span>;
  }
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
