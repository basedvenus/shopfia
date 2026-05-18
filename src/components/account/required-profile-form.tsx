"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Camera, Sparkles } from "lucide-react";
import { completeRequiredProfileAction } from "@/app/actions/auth";
import { useProfile } from "@/components/account/profile-provider";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import type { SharedUserProfile } from "@/lib/user-profile";

type RequiredProfileFormProps = {
  defaultDisplayName?: string | null;
  defaultImage?: string | null;
  defaultImageCrop?: unknown;
  defaultUsername?: string | null;
};

export function RequiredProfileForm({
  defaultDisplayName,
  defaultImage,
  defaultImageCrop,
  defaultUsername
}: RequiredProfileFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { profile, setProfile } = useProfile();

  function onAvatarUploaded(profileFromUpload?: SharedUserProfile) {
    if (profileFromUpload) {
      setProfile(profileFromUpload);
    }
  }

  return (
    <form
      action={(formData) => {
        setMessage(null);
        startTransition(async () => {
          const result = await completeRequiredProfileAction(formData);
          if (!result.ok) {
            setMessage(result.error ?? "Could not save your username.");
            return;
          }

          if (result.profile) setProfile(result.profile);
          router.replace("/welcome");
          router.refresh();
        });
      }}
      className="grid gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-[150px_1fr] sm:items-start">
        <div className="grid justify-items-start gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#9b6b65]">
            <Camera className="h-3.5 w-3.5" />
            Optional photo
          </div>
          <ImageUploadField
            name="image"
            label="Profile photo"
            defaultValue={profile?.image ?? defaultImage}
            defaultCrop={(profile?.imageCrop ?? defaultImageCrop) as { x: number; y: number; zoom: number } | null}
            value={profile?.image ?? defaultImage}
            valueCrop={(profile?.imageCrop ?? defaultImageCrop) as { x: number; y: number; zoom: number } | null}
            rounded="full"
            helperText="Upload now or add one later."
            onUploadComplete={(result) => onAvatarUploaded(result.profile)}
            uploadEndpoint="/api/uploads/avatar"
          />
        </div>
        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="text-sm font-medium">Create username</span>
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="username"
                defaultValue={profile?.username ?? defaultUsername ?? ""}
                placeholder="venus"
                className="pl-9"
                autoComplete="username"
                required
              />
            </div>
          </label>
          <p className="rounded-2xl bg-[#fff8f5] px-3 py-2 text-xs leading-5 text-muted-foreground">
            Your public ShopFia identity starts with @ and appears when you tag parties,
            comment, favorite, message, and create future vendor profiles. Vendor profiles
            are optional and separate.
          </p>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Display name</span>
            <Input
              name="name"
              defaultValue={profile?.name ?? defaultDisplayName ?? ""}
              placeholder="Venus Taillant"
              autoComplete="name"
              required
            />
          </label>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        <Sparkles className="h-4 w-4" />
        {isPending ? "Saving..." : "Continue"}
      </Button>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </form>
  );
}
