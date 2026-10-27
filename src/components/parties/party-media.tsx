import { getAppleMusicPlaylist, getTikTokVideo } from "@/lib/party-media";

export function PartyMedia({ tiktokUrl, appleMusicUrl }: { tiktokUrl?: string | null; appleMusicUrl?: string | null }) {
  const video = getTikTokVideo(tiktokUrl);
  const playlist = getAppleMusicPlaylist(appleMusicUrl);
  if (!video && !playlist) return null;
  return <section aria-label="Party video and music" className="grid min-w-0 gap-5 sm:grid-cols-2">
    {video ? <article className="min-w-0 rounded-3xl border bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Party video</h2>
      <iframe src={video.embedUrl} title="Party TikTok video" loading="lazy" allow="fullscreen; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="mx-auto aspect-[9/16] w-full max-w-[360px] rounded-2xl border-0" />
      <a href={video.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-primary underline">Open on TikTok</a>
      <p className="mt-1 text-xs text-muted-foreground">The video must be public and allow embedding.</p>
    </article> : null}
    {playlist ? <article className="min-w-0 rounded-3xl border bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Party playlist</h2>
      <iframe src={playlist.embedUrl} title="Party Apple Music playlist" loading="lazy" allow="encrypted-media; fullscreen" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation" className="h-[450px] w-full rounded-2xl border-0" />
      <a href={playlist.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-primary underline">Open in Apple Music</a>
      <p className="mt-1 text-xs text-muted-foreground">Public playlists show their artwork automatically. Apple Music controls preview availability.</p>
    </article> : null}
  </section>;
}
