import { normalizeImageCrop } from "@/lib/image-crop";
import { CroppedImage } from "./cropped-image";

export function BusinessLogo({ src, alt, crop, className }: {
  src: string;
  alt: string;
  crop: unknown;
  className?: string;
}) {
  const saved = normalizeImageCrop(crop);
  const ratio = saved.aspectRatio ?? 4 / 3;
  const scale = 0.98 / Math.hypot(ratio, 1);
  const frame = { ...saved, aspectRatio: ratio };

  return (
    <span className={className} style={{ display: "block", position: className?.split(/\s+/).includes("absolute") ? "absolute" : "relative", overflow: "hidden", borderRadius: "50%" }}>
        <span aria-hidden="true" className="absolute inset-0">
          <CroppedImage
            src={src}
            crop={{ ...frame, zoom: Math.max(1, frame.zoom) }}
            frameFit="cover"
            className="h-full w-full scale-125 blur-2xl"
          />
        </span>
      <span className="relative grid h-full w-full place-items-center">
        <CroppedImage
          src={src}
          alt={alt}
          crop={frame}
          frameFit="contain"
          className="business-logo-image"
          frameStyle={{ width: `${ratio * scale * 100}%`, height: `${scale * 100}%` }}
        />
      </span>
    </span>
  );
}
