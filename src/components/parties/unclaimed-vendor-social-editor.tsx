"use client";

import { useState, useTransition } from "react";
import { updateUnclaimedVendorSocialsAction } from "@/app/actions/vendor";
import { getVendorSocialProfile } from "@/lib/vendor-social";
import { type VendorOption } from "@/components/parties/party-event-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Socials = { instagramUrl: string | null; tiktokUrl: string | null; website: string | null };

export function UnclaimedVendorSocialEditor({ vendor, photoId, onSaved }: { vendor: VendorOption; photoId: string; onSaved: (socials: Socials) => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [instagram, setInstagram] = useState(() => getVendorSocialProfile(vendor.instagramUrl, "instagram")?.handle ?? vendor.instagramUrl ?? "");
  const [tiktok, setTiktok] = useState(() => getVendorSocialProfile(vendor.tiktokUrl, "tiktok")?.handle ?? vendor.tiktokUrl ?? "");
  const [website, setWebsite] = useState(vendor.website ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  if (vendor.status !== "UNCLAIMED") return null;
  return <div className="mt-3">
    <button type="button" aria-expanded={open} className="text-sm font-medium text-primary underline" onClick={() => setOpen((value) => !value)}>{open ? "Hide social links" : "Edit social links"}</button>
    {saved ? <p role="status" className="mt-2 text-xs text-muted-foreground">Social links updated on the vendor page.</p> : null}
    {open ? <fieldset disabled={pending} className="mt-3 grid gap-3 rounded-xl border bg-white p-3">
      <legend className="px-1 text-sm font-semibold">{vendor.name} · public links</legend>
      <p className="text-xs text-muted-foreground">Add a username with or without @, or paste a profile link. Public feeds appear on their vendor page when embeds are allowed. You can update these links until the business claims its profile.</p>
      <label className="grid gap-1 text-sm">Instagram username or profile link<Input value={instagram} maxLength={255} onChange={(event) => setInstagram(event.target.value)} placeholder="@businessname" autoCapitalize="none" autoCorrect="off" /></label>
      <label className="grid gap-1 text-sm">TikTok username or profile link<Input value={tiktok} maxLength={255} onChange={(event) => setTiktok(event.target.value)} placeholder="@businessname" autoCapitalize="none" autoCorrect="off" /></label>
      <label className="grid gap-1 text-sm">Business website<Input value={website} maxLength={2048} onChange={(event) => setWebsite(event.target.value)} placeholder="business.com" autoCapitalize="none" autoCorrect="off" /></label>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">Saving updates the public vendor profile immediately.</p>
      <Button type="button" className="w-fit" onClick={() => {
        setError("");
        setSaved(false);
        startTransition(async () => {
          try {
            const result = await updateUnclaimedVendorSocialsAction({ vendorId: vendor.id, photoId, instagram, tiktok, website, original: { instagramUrl: vendor.instagramUrl ?? null, tiktokUrl: vendor.tiktokUrl ?? null, website: vendor.website ?? null } });
            if (!result.ok) { setError(result.error); return; }
            onSaved(result.socials);
            setSaved(true);
            setOpen(false);
          } catch { setError("Could not save these links. Your changes are still here; please try again."); }
        });
      }}>{pending ? "Saving…" : "Save social links"}</Button>
    </fieldset> : null}
  </div>;
}
