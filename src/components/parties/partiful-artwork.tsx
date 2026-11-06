"use client";

import { useState } from "react";
import { getPartyInvitation } from "@/lib/party-invitation";
import { getPartifulInvite } from "@/lib/partiful";

export function PartifulArtwork({ url }: { url?: string | null }) {
  const invitation = getPartyInvitation(url);
  if (invitation?.provider === "luma") return <section aria-label="Invitation" className="rounded-3xl border bg-white p-4"><h2 className="mb-3 text-lg font-semibold">Invitation</h2><a href={invitation.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">View invitation on Luma</a></section>;
  const invite = getPartifulInvite(url);
  return invite ? <Artwork key={invite} invite={invite} /> : null;
}

function Artwork({ invite }: { invite: string }) {
  const [unavailable, setUnavailable] = useState(false);
  return <section aria-label="Invitation design" className="min-w-0 space-y-3 rounded-3xl border bg-white p-4">
    <h2 className="text-lg font-semibold">Invitation design</h2>
    {unavailable ? <p role="status" className="text-sm text-muted-foreground">The invitation artwork couldn’t load. You can upload the artwork as a party photo instead.</p> : <img src={`/api/partiful-artwork?url=${encodeURIComponent(invite)}`} alt="Party invitation artwork" loading="lazy" referrerPolicy="no-referrer" onError={() => setUnavailable(true)} className="max-h-[600px] w-full rounded-2xl object-contain" />}
  </section>;
}
