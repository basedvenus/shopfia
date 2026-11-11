import { CropGeometryImage } from "./crop-geometry-image";
import { normalizeImageCrop, type ImageCrop } from "@/lib/image-crop";
import type { CSSProperties, ReactEventHandler } from "react";

type CroppedImageProps = {
  alt?: string;
  className?: string;
  crop?: ImageCrop | null;
  frameStyle?: CSSProperties;
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
  frameStyle,
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
    return <span className={className} style={{ display: "block", overflow: "hidden", position: /(?:^|\s)absolute(?:\s|$)/.test(className ?? "") ? "absolute" : "relative", containerType: "size", ...frameStyle }}>
      <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", overflow: "hidden", width: `${fit}(100cqw, calc(100cqh * ${ratio}))`, height: `${fit}(100cqh, calc(100cqw / ${ratio}))` }}>
        <CropGeometryImage src={src} alt={alt} decoding={decoding} loading={loading} onError={onError} crop={normalized}/>
      </span>
    </span>;
  }
  return <span className={className} style={{display:"block",overflow:"hidden",position:/(?:^|\s)absolute(?:\s|$)/.test(className??"")?"absolute":"relative"}}><CropGeometryImage src={src} alt={alt} decoding={decoding} loading={loading} onError={onError} crop={normalized} contain={frameFit==="contain"}/></span>;
}
