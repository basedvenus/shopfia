import { normalizeImageCrop, imageCropToCss, type ImageCrop } from "@/lib/image-crop";
import type { ReactEventHandler } from "react";

type CroppedImageProps = {
  alt?: string;
  className?: string;
  crop?: ImageCrop | null;
  frameFit?: "cover" | "contain";
  decoding?: "async" | "auto" | "sync";
  loading?: "eager" | "lazy";
  onError?: ReactEventHandler<HTMLImageElement>;
  src: string;
};

export function CroppedImage({
  alt = "",
  className,
  crop,
  frameFit = "cover",
  decoding = "async",
  loading = "lazy",
  onError,
  src
}: CroppedImageProps) {
  const normalized = normalizeImageCrop(crop);
  if (normalized.aspectRatio) {
    const ratio = normalized.aspectRatio;
    const fit = frameFit === "contain" ? "min" : "max";
    // A virtual frame preserves the selected crop before fitting it to the card.
    // Contain shows the whole saved frame; cover fills banners without exposing excluded pixels.
    return <span className={className} style={{ display: "block", overflow: "hidden", position: /(?:^|\s)absolute(?:\s|$)/.test(className ?? "") ? "absolute" : "relative", containerType: "size" }}>
      <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", overflow: "hidden", width: `${fit}(100cqw, calc(100cqh * ${ratio}))`, height: `${fit}(100cqh, calc(100cqw / ${ratio}))` }}>
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
