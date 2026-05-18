"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Instagram, Music2, Sparkles, UserRound } from "lucide-react";
import { updateAccountProfileAction } from "@/app/actions/auth";
import { useProfile } from "@/components/account/profile-provider";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProfileAvatarPreview } from "@/components/account/profile-avatar-preview";
import type { SharedUserProfile } from "@/lib/user-profile";

type AccountProfileEditorProps = {
  displayName: string;
  handle: string;
  initials: string;
  signOutAction: () => Promise<void>;
};

export function AccountProfileEditor({
  displayName,
  handle,
  initials,
  signOutAction
}: AccountProfileEditorProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { profile, setProfile } = useProfile();

  function onAvatarUploaded(profileFromUpload?: SharedUserProfile) {
    if (profileFromUpload) {
      setProfile(profileFromUpload);
    }
  }

  const currentDisplayName = profile?.name || displayName;
  const currentHandle = profile?.username ? `@${profile.username}` : handle;

  return (
    <>
      <div className="bg-[linear-gradient(135deg,rgba(234,184,179,0.34),rgba(255,255,255,0.8),rgba(253,230,208,0.45))] p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex flex-wrap items-center gap-4">
            <ProfileAvatarPreview
              crop={profile?.imageCrop as { x: number; y: number; zoom: number } | null}
              image={profile?.image}
              initials={initials}
              displayName={currentDisplayName}
            />
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Creator profile</p>
                <h1 className="text-3xl font-semibold tracking-tight">{currentDisplayName}</h1>
                <p className="text-sm font-medium text-muted-foreground">{currentHandle}</p>
              </div>
              {profile?.username ? (
                <Link href={`/profiles/${profile.username}`}>
                  <Button variant="secondary" size="sm">View public profile</Button>
                </Link>
              ) : null}
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {profile?.bio ||
                  "Add a short bio so vendors and party guests can understand your style, event aesthetic, and what you love creating."}
              </p>
              <div className="flex flex-wrap gap-2">
                {profile?.instagramUrl ? (
                  <Link href={profile.instagramUrl} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs" target="_blank">
                    <Instagram className="h-3.5 w-3.5" />
                    Instagram
                  </Link>
                ) : null}
                {profile?.tiktokUrl ? (
                  <Link href={profile.tiktokUrl} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs" target="_blank">
                    <Music2 className="h-3.5 w-3.5" />
                    TikTok
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
          <form action={signOutAction}>
            <Button variant="secondary">Sign out</Button>
          </form>
        </div>
      </div>

      <div id="settings" className="grid gap-4 border-t border-border/60 p-5 md:grid-cols-[1.2fr_0.8fr]">
        <form
          action={(formData) => {
            setMessage(null);
            startTransition(async () => {
              const result = await updateAccountProfileAction(formData);
              if (!result.ok) {
                setMessage(result.error ?? "Could not save your profile.");
                return;
              }

              if (result.profile) {
                setProfile(result.profile);
              }

              setMessage("Profile saved.");
              router.refresh();
            });
          }}
          className="grid gap-3"
        >
          <div className="flex items-center gap-2 font-semibold">
            <UserRound className="h-4 w-4 text-primary" />
            Edit profile
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="name" defaultValue={profile?.name ?? ""} placeholder="Display name" required />
            <Input name="username" defaultValue={profile?.username ?? ""} placeholder="username" required />
          </div>
          <Textarea name="bio" defaultValue={profile?.bio ?? ""} placeholder="About your party style, favorite themes, or what you are planning..." className="min-h-[90px]" />
          <ImageUploadField
            name="image"
            label="Profile picture"
            defaultValue={profile?.image}
            defaultCrop={profile?.imageCrop as { x: number; y: number; zoom: number } | null}
            value={profile?.image}
            valueCrop={profile?.imageCrop as { x: number; y: number; zoom: number } | null}
            rounded="full"
            helperText="Click to upload. The image is saved to your profile when the upload finishes."
            onUploadComplete={(result) => onAvatarUploaded(result.profile)}
            uploadEndpoint="/api/uploads/avatar"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="instagramUrl" defaultValue={profile?.instagramUrl ?? ""} placeholder="Instagram URL" />
            <Input name="tiktokUrl" defaultValue={profile?.tiktokUrl ?? ""} placeholder="TikTok URL" />
          </div>
          <Button type="submit" className="w-full sm:w-fit" disabled={isPending}>
            {isPending ? "Saving..." : "Save profile"}
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </form>

        <div className="grid gap-3 rounded-[1.5rem] bg-muted/60 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Profile goals
          </div>
          <p>Make your account feel social, trusted, and creator-led. Use a clear handle, a warm bio, and visual links that show your event style.</p>
          <p className="text-xs">Uploads preview immediately and save with your profile for this MVP; cloud media storage can be layered in later.</p>
        </div>
      </div>
    </>
  );
}
