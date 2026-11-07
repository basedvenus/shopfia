"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Instagram, Music2, Pencil } from "lucide-react";
import { updateAccountProfileAction } from "@/app/actions/auth";
import { useProfile } from "@/components/account/profile-provider";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AccountProfileEditor({ displayName, handle, signOutAction, firstName = null, lastName = null, preview = false }: {
  displayName: string; handle: string; initials: string; signOutAction: () => Promise<void>; preview?: boolean; firstName?: string | null; lastName?: string | null;
}) {
  const { profile, updateProfile } = useProfile();
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [previewUsernameChanged, setPreviewUsernameChanged] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function save(form: FormData) {
    const data = new FormData();
    for (const key of ["name", "username", "bio", "instagramUrl", "tiktokUrl"] as const) {
      data.set(key, String(form.has(key) ? form.get(key) ?? "" : profile?.[key] ?? ""));
    }
    for (const key of ["firstName", "lastName"]) {
      if (form.has(key)) data.set(key, String(form.get(key) ?? ""));
    }
    if (preview && profile) {
      const changed = data.get("username") !== profile.username;
      if (changed && previewUsernameChanged) {setMessage("You can change your username once every 30 days.");return;}
      if (changed) setPreviewUsernameChanged(true);
      const publicData = Object.fromEntries([...data.entries()].filter(([key]) => key !== "firstName" && key !== "lastName"));
      updateProfile(publicData, profile.id);
      setEditing(null); setMessage("Preview profile saved."); return;
    }
    setMessage("");
    startTransition(async () => {
      try {
        const result = await updateAccountProfileAction(data);
        if (!result.ok) { setMessage(result.error ?? "Could not save your profile."); return; }
        if (result.profile) updateProfile(result.profile, result.profile.id);
        setEditing(null); setMessage("Profile saved."); router.refresh();
      } catch { setMessage("Could not save your profile. Please try again."); }
    });
  }
  return <div id="settings" className="bg-[linear-gradient(135deg,rgba(234,184,179,0.34),rgba(255,255,255,0.8))] p-5 md:p-7">
    <div className="flex flex-wrap items-start gap-6">
      <ImageUploadField editMenu name="image" label="Profile picture" rounded="full" value={profile?.image} valueCrop={profile?.imageCrop as {x:number;y:number;zoom:number}|null} uploadEndpoint="/api/uploads/avatar" onUploadComplete={({profile: updated}) => { if(updated) updateProfile({image:updated.image,imageCrop:updated.imageCrop},updated.id); }} />
      <div className="min-w-0 flex-1 space-y-3">
        <div><p className="text-sm text-muted-foreground">Profile settings</p><h1 className="text-3xl font-semibold"><button type="button" className="text-left hover:underline underline-offset-4" aria-label="Edit profile name" aria-expanded={editing === "name"} onClick={() => setEditing(editing === "name" ? null : "name")}>{profile?.name || displayName}</button></h1><p className="text-muted-foreground">{profile?.username ? `@${profile.username}` : handle}</p></div>
        <button type="button" className="group flex items-center gap-2 text-left text-sm text-muted-foreground" aria-label="Edit bio" aria-expanded={editing === "bio"} onClick={() => setEditing(editing === "bio" ? null : "bio")}>{profile?.bio || "Add a bio"}<Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" /></button>
        {profile?.username ? <Link className="inline-block text-sm font-medium underline underline-offset-4" href={`/profiles/${profile.username}`}>View public profile</Link> : null}
        <div className="flex items-center gap-2">{([{key:"instagramUrl", label:"Instagram", Icon:Instagram}, {key:"tiktokUrl",label:"TikTok",Icon:Music2}] as const).map(({key,label,Icon}) => <button key={key} type="button" aria-label={`Edit ${label}`} aria-expanded={editing === key} onClick={() => setEditing(editing === key ? null : key)} title={`Edit ${label}`} className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-white/90 text-foreground shadow-sm transition hover:border-primary/40 hover:bg-white"><Icon className="h-4 w-4" /><Pencil className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white p-0.5 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" /></button>)}</div>
        {editing ? <form key={editing} action={save} className="grid max-w-lg gap-3 rounded-2xl border bg-white/80 p-4">
          {editing === "bio" ? <label className="grid gap-1 text-sm">Bio<Textarea name="bio" defaultValue={profile?.bio ?? ""} maxLength={280} autoFocus /></label> : editing === "name" ? <label className="grid gap-1 text-sm"><span>Profile name<span aria-hidden="true">*</span></span><Input name="name" defaultValue={profile?.name ?? ""} required autoFocus /></label> : <label className="grid gap-1 text-sm">{editing === "instagramUrl" ? "Instagram" : "TikTok"} username or link<Input name={editing} defaultValue={editing === "instagramUrl" ? profile?.instagramUrl ?? "" : profile?.tiktokUrl ?? ""} /></label>}
          <div className="flex gap-2"><Button disabled={pending} type="submit">{pending ? "Saving…" : "Save"}</Button><Button disabled={pending} variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button></div>
        </form> : null}

      </div>
      <form action={signOutAction}><Button variant="secondary">Sign out</Button></form>
    </div>
    <form action={save} className="mt-6 grid gap-4 border-t border-border/60 pt-5">
      <h2 className="font-semibold">Profile details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium"><span>First name<span aria-hidden="true">*</span></span><Input name="firstName" defaultValue={firstName ?? ""} autoComplete="given-name" required maxLength={80} /></label>
        <label className="grid gap-2 text-sm font-medium"><span>Last name<span aria-hidden="true">*</span></span><Input name="lastName" defaultValue={lastName ?? ""} autoComplete="family-name" required maxLength={80} /></label>
      </div>
      <p className="text-xs text-muted-foreground">Your first and last name are account details. Your profile name and username appear on your public profile.</p>
      <label className="grid gap-2 text-sm font-medium"><span>Profile name<span aria-hidden="true">*</span></span><Input name="name" defaultValue={profile?.name ?? ""} key={`name-${profile?.name}`} required maxLength={80} /></label>
      <label className="grid gap-2 text-sm font-medium"><span>Profile username<span aria-hidden="true">*</span></span><Input name="username" defaultValue={profile?.username ?? ""} key={`username-${profile?.username}`} required minLength={3} maxLength={30} aria-describedby="username-rule" /></label>
      <p id="username-rule" className="text-xs text-muted-foreground">You can change your username once every 30 days. Your previous username is reserved for you for 30 days after a change. After that, someone else can claim it. Changing your username also changes your public profile link.</p>
      <Button type="submit" className="w-fit" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
    </form>
    {message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}
  </div>;
}
