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
  const [isVendor, setIsVendor] = useState<"yes" | "no" | null>(null);
  const [storefrontName, setStorefrontName] = useState("");
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
            helperText="Upload a photo you choose, or keep your initials. Google photos are not used."
            onUploadComplete={(result) => onAvatarUploaded(result.profile)}
            uploadEndpoint="/api/uploads/avatar"
          />
        </div>
        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="text-sm font-medium">{savedUsername ? "Your username" : "Create your username"}</span>
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="username"
                defaultValue={profile?.username ?? defaultUsername ?? ""}
                placeholder="your-username"
                className="pl-9"
                autoComplete="username"
                readOnly={Boolean(savedUsername)}
                required
              />
            </div>
          </label>
          <p className="rounded-2xl bg-[#fff8f5] px-3 py-2 text-xs leading-5 text-muted-foreground">
            This is your personal @username for messages, reviews, and parties. Your
            personal profile is at shopfia.app/profiles/your-username. It is separate
            from your storefront name and storefront URL.
          </p>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Display name</span>
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

      <fieldset className="grid gap-3 rounded-2xl border border-border bg-[#fff8f5] p-4">
        <legend className="px-1 text-base font-semibold">Are you a vendor?</legend>
        <div className="flex flex-wrap gap-5">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="isVendor" value="yes" checked={isVendor === "yes"} onChange={() => setIsVendor("yes")} required />
            Yes
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="isVendor" value="no" checked={isVendor === "no"} onChange={() => setIsVendor("no")} required />
            No
          </label>
        </div>
        {isVendor === "yes" ? (
          <div className="grid gap-3">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Create your storefront name</span>
              <Input name="storefrontName" value={storefrontName} onChange={(event) => setStorefrontName(event.target.value)} placeholder="Your business name" minLength={2} maxLength={80} required />
            </label>
            <p className="text-xs leading-5 text-muted-foreground">
              This is your public business name, separate from your personal display
              name and @username. Next, you will choose a separate storefront URL,
              such as shopfia.app/your-storefront, and add your business details.
              Your storefront is created only when you save those details.
            </p>
          </div>
        ) : isVendor === "no" ? (
          <p className="text-xs leading-5 text-muted-foreground">You can browse, plan parties, and message vendors. You can add a storefront later.</p>
        ) : null}
      </fieldset>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        <Sparkles className="h-4 w-4" />
        {isPending ? "Saving..." : isVendor === "yes" ? "Continue to storefront setup" : "Continue"}
      </Button>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </form>
  );
}
