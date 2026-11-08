"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeRequiredProfileAction } from "@/app/actions/auth";
import { useProfile } from "@/components/account/profile-provider";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import type { SharedUserProfile } from "@/lib/user-profile";

type RequiredProfileFormProps = {
  profileId: string;
  defaultDisplayName?: string | null;
  defaultImage?: string | null;
  defaultImageCrop?: unknown;
  defaultUsername?: string | null;
};

export function RequiredProfileForm({
  profileId,
  defaultDisplayName,
  defaultImage,
  defaultImageCrop,
  defaultUsername
}: RequiredProfileFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { profile: contextProfile, updateProfile } = useProfile();
  const profile = contextProfile?.id === profileId ? contextProfile : null;
  const savedUsername = profile?.username ?? defaultUsername;
  const savedDisplayName = profile?.name ?? defaultDisplayName;

  function onAvatarUploaded(profileFromUpload?: SharedUserProfile) {
    if (profileFromUpload?.id === profileId) {
      updateProfile({
        image: profileFromUpload.image,
        imageCrop: profileFromUpload.imageCrop
      }, profileId);
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

          if (result.profile) updateProfile(result.profile, profileId);
          router.replace(result.nextPath ?? "/account");
          router.refresh();
        });
      }}
      className="grid gap-5"
    >
      <input type="hidden" name="profileId" value={profileId} />
      <div className="grid gap-4 sm:grid-cols-[150px_1fr] sm:items-start">
        <div className="grid justify-items-start gap-2">
          <ImageUploadField
            name="image"
            label="Profile photo"
            defaultValue={profile?.image ?? defaultImage}
            defaultCrop={(profile?.imageCrop ?? defaultImageCrop) as { x: number; y: number; zoom: number } | null}
            value={profile?.image ?? defaultImage}
            valueCrop={(profile?.imageCrop ?? defaultImageCrop) as { x: number; y: number; zoom: number } | null}
            rounded="full"
            hideFormatDetailsUntilInteraction
            onUploadComplete={(result) => onAvatarUploaded(result.profile)}
            uploadEndpoint="/api/uploads/avatar"
          />
        </div>
        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="text-sm font-medium">{savedUsername ? "Your username" : "Create your username"} <span className="text-red-600" aria-hidden="true">*</span></span>
            <div className="relative">
              <Input
                name="username"
                defaultValue={profile?.username ?? defaultUsername ?? ""}
                placeholder="your-username"
                autoComplete="username"
                readOnly={Boolean(savedUsername)}
                required
              />
            </div>
          </label>
          <p className="rounded-2xl bg-[#fff8f5] px-3 py-2 text-xs leading-5 text-muted-foreground">
            This is your personal username for messages, parties, and personal profiles.
          </p>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Display name <span className="text-red-600" aria-hidden="true">*</span></span>
            <Input
              name="name"
              defaultValue={profile?.name ?? defaultDisplayName ?? ""}
              placeholder="Venus Taillant"
              autoComplete="name"
              readOnly={Boolean(savedDisplayName)}
              required
            />
          </label>
          <p className="text-xs leading-5 text-muted-foreground">
            Your display name is the name people see. Your @username is your unique personal handle.
            {savedDisplayName || savedUsername ? " Your saved details are kept here; you can edit them later in Account settings." : ""}
          </p>
        </div>
      </div>


      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Saving..." : "Continue"}
      </Button>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </form>
  );
}
