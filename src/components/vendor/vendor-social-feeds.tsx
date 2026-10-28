"use client";

import { useEffect, useRef } from "react";
import { getVendorSocialProfile } from "@/lib/vendor-social";

export function VendorSocialFeeds({ instagramUrl, tiktokUrl }: { instagramUrl?: string | null; tiktokUrl?: string | null }) {
  const instagram = getVendorSocialProfile(instagramUrl, "instagram");
  const tiktok = getVendorSocialProfile(tiktokUrl, "tiktok");
  if (!instagram && !tiktok) return null;
  return <div className="grid gap-6">
    <p className="text-sm text-muted-foreground">Public social feeds. If a feed is unavailable, open the profile to see more.</p>
    {instagram ? <section aria-label="Instagram feed" className="min-w-0 overflow-hidden rounded-2xl border bg-white p-4">
      <h3 className="mb-3 font-semibold">Instagram · @{instagram.handle}</h3>
      <iframe title={`Instagram feed from @${instagram.handle}`} src={`${instagram.url}embed/`} loading="lazy" className="h-[620px] w-full rounded-xl border-0" referrerPolicy="strict-origin-when-cross-origin" />
      <a className="mt-3 inline-block text-sm underline" href={instagram.url} target="_blank" rel="noopener noreferrer">Open Instagram profile</a>
    </section> : null}
    {tiktok ? <section aria-label="TikTok feed" className="min-w-0 overflow-hidden rounded-2xl border bg-white p-4">
      <h3 className="mb-3 font-semibold">TikTok · @{tiktok.handle}</h3>
      <TikTokCreatorEmbed key={tiktok.url} url={tiktok.url} handle={tiktok.handle} />
      <a className="mt-3 inline-block text-sm underline" href={tiktok.url} target="_blank" rel="noopener noreferrer">Open TikTok profile</a>
    </section> : null}
  </div>;
}

function TikTokCreatorEmbed({ url, handle }: { url: string; handle: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    // Keep provider DOM mutations inside an empty React-owned container. A fresh
    // script processes this profile on client navigation as well as initial load.
    const quote = document.createElement("blockquote");
    quote.className = "tiktok-embed";
    quote.cite = url;
    quote.dataset.uniqueId = handle;
    quote.dataset.embedType = "creator";
    quote.style.cssText = "max-width:720px;min-width:288px";
    const section = document.createElement("section");
    const link = document.createElement("a");
    link.href = url;
    link.textContent = `@${handle}`;
    section.append(link);
    quote.append(section);
    const script = document.createElement("script");
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    root.replaceChildren(quote, script);
    return () => root.replaceChildren();
  }, [url, handle]);
  return <div ref={container} className="min-h-80" />;
}
