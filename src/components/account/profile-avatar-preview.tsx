import { CroppedImage } from "@/components/ui/cropped-image";
import type { ImageCrop } from "@/lib/image-crop";

type ProfileAvatarPreviewProps = {
  crop?: ImageCrop | null;
  image?: string | null;
  initials: string;
  displayName: string;
};

export function ProfileAvatarPreview({
  crop,
  image,
  initials,
  displayName
}: ProfileAvatarPreviewProps) {
  return (
    <div className="grid aspect-square h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-accent text-2xl font-semibold shadow-soft">
      {image ? (
        <CroppedImage
          key={image}
          src={image}
          alt={displayName}
          crop={crop}
          className="block h-full w-full object-cover object-center"
        />
      ) : (
        initials
      )}
    </div>
  );
}
