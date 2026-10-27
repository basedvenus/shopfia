"use client";

import { useState } from "react";
import { getPartifulInvite } from "@/lib/partiful";

export function PartifulArtwork({ url }: { url?: string | null }) {
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
