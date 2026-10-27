"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPartyContributionAction, reviewPartyContributionAction } from "@/app/actions/party-contributions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PartyContributionForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState("PHOTO");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return <form className="grid gap-3" action={(form) => {
    setMessage("");
    startTransition(async () => {
      try {
        if (kind === "PHOTO") {
          const file = form.get("file");
          if (!(file instanceof File) || !file.size) { setMessage("Choose a photo first."); return; }
          const upload = new FormData(); upload.set("file", file);
          const response = await fetch("/api/uploads/party-photo", { method: "POST", body: upload });
          const body = await response.json();
          if (!response.ok) { setMessage(body.error ?? "Could not upload this photo."); return; }
          form.set("photoId", body.photo.id);
        }
        // The image was uploaded above. Sending it again exceeds Server Action limits.
        const submission = new FormData();
        for (const key of ["eventId", "kind", "photoId", "url"]) {
          const value = form.get(key);
          if (typeof value === "string") submission.set(key, value);
        }
        const result = await submitPartyContributionAction(submission);
        if (!result.ok) { setMessage(result.error ?? "Could not submit this item."); return; }
        setMessage("Sent to the host for approval. Only you and the host can see it until it is approved.");
        router.refresh();
      } catch { setMessage("Could not submit this item. Please try again."); }
    });
  }}>
    <input type="hidden" name="eventId" value={eventId} />
    <label className="grid gap-2 text-sm font-medium">What would you like to add?<select name="kind" value={kind} disabled={pending} onChange={(event) => setKind(event.target.value)} className="h-11 rounded-xl border bg-white px-3"><option value="PHOTO">Photo</option><option value="TIKTOK">TikTok video</option><option value="PLAYLIST">Apple Music or Spotify playlist</option></select></label>
    {kind === "PHOTO" ? <label className="grid gap-2 text-sm">Photo<input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/gif" required disabled={pending} /><span className="text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF, up to 10 MB.</span></label> : <label className="grid gap-2 text-sm">{kind === "TIKTOK" ? "TikTok video link" : "Public Apple Music or Spotify playlist link"}<Input key={kind} type="url" name="url" maxLength={2048} required disabled={pending} placeholder={kind === "TIKTOK" ? "https://www.tiktok.com/@you/video/…" : "https://music.apple.com/us/playlist/…"} /></label>}
    <Button type="submit" className="w-fit" disabled={pending}>{pending ? "Submitting…" : "Send to host for approval"}</Button>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </form>;
}

export function ContributionReviewControls({ contributionId }: { contributionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return <form className="mt-3 flex flex-wrap gap-2" action={(form) => {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await reviewPartyContributionAction(form);
        if (!result.ok) setMessage(result.error ?? "Could not review this item.");
        else router.refresh();
      } catch { setMessage("Could not review this item. Please try again."); }
    });
  }}>
    <input type="hidden" name="contributionId" value={contributionId} />
    <Button name="decision" value="APPROVED" type="submit" disabled={pending}>Approve</Button>
    <Button name="decision" value="REJECTED" type="submit" variant="secondary" disabled={pending}>Decline</Button>
    {message ? <p role="alert" className="w-full text-sm text-destructive">{message}</p> : null}
  </form>;
}
