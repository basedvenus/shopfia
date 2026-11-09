"use client";

import { useRouter } from "next/navigation";
import { useProfile } from "@/components/account/profile-provider";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import type { ImageCrop } from "@/lib/image-crop";

export function EditableProfileAvatar({ userId, image, crop, initials, displayName }: {
  userId: string; image: string | null; crop: ImageCrop; initials: string; displayName: string;
}) {
  const { profile, updateProfile } = useProfile();
  const router = useRouter();
  const current = profile?.id === userId ? profile : null;
  return <ImageUploadField
    editMenu
    avatarAppearance={{initials, displayName}}
    name="image"
    label="Profile picture"
    rounded="full"
    value={current?.image ?? image}
    valueCrop={(current?.imageCrop as ImageCrop | null) ?? crop}
    uploadEndpoint="/api/uploads/avatar"
    onUploadComplete={({profile: saved}) => {
      if (saved) updateProfile({image:saved.image, imageCrop:saved.imageCrop}, saved.id);
      router.refresh();
    }}
  />;
}
