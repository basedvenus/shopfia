"use client";

import { getVendorSocialProfile } from "@/lib/vendor-social";

export function VendorSocialFeeds({ instagramUrl, tiktokUrl }: { instagramUrl?: string | null; tiktokUrl?: string | null }) {
  const instagram = getVendorSocialProfile(instagramUrl, "instagram");
  const tiktok = getVendorSocialProfile(tiktokUrl, "tiktok");
  if (!instagram && !tiktok) return null;
  return <div className="grid min-w-0 gap-3 md:grid-cols-2">
    <p className="text-sm text-muted-foreground md:col-span-2">Public social feeds. If a feed is unavailable, open the profile to see more.</p>
    {instagram ? <section aria-label="Instagram feed" className="min-w-0 overflow-hidden">
      <h3 className="mb-3 font-semibold">Instagram · @{instagram.handle}</h3>
      <iframe title={`Instagram feed from @${instagram.handle}`} src={`${instagram.url}embed/`} loading="lazy" className="h-[620px] w-full rounded-xl border-0" referrerPolicy="strict-origin-when-cross-origin" />
      <a className="mt-3 inline-block text-sm underline" href={instagram.url} target="_blank" rel="noopener noreferrer">Open Instagram profile</a>
    </section> : null}
    {tiktok ? <section aria-label="TikTok feed" className="min-w-0 overflow-hidden">
      <h3 className="mb-3 font-semibold">TikTok · @{tiktok.handle}</h3>
      <iframe title={`TikTok videos from @${tiktok.handle}`} src={`https://www.tiktok.com/embed/@${encodeURIComponent(tiktok.handle)}`} loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" allow="autoplay; encrypted-media; fullscreen" className="h-[740px] w-full rounded-xl border-0" referrerPolicy="strict-origin-when-cross-origin" />
      <a className="mt-3 inline-block text-sm underline" href={tiktok.url} target="_blank" rel="noopener noreferrer">Open TikTok profile</a>
    </section> : null}
  </div>;
}

