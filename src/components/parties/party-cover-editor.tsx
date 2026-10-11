import { CroppedImage } from "@/components/ui/cropped-image";
import { type ImageCrop } from "@/lib/image-crop";
import Link from "next/link";
import { Pencil } from "lucide-react";

export function PartyCoverEditor({ slug, imageUrl, crop, editable }: { eventId?: string; slug?: string; imageUrl: string; crop: ImageCrop; editable: boolean }) {
  return <>
    <div className="absolute inset-0 overflow-hidden">
      <CroppedImage src={imageUrl} crop={crop} alt="" loading="eager" className="h-full w-full object-cover" />
    </div>
    {editable && slug ? <Link href={`/events/${slug}?edit=1`} aria-label="Edit party and photos" title="Edit party and photos" className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-white shadow-md"><Pencil className="h-4 w-4" /></Link> : null}
  </>;
}
