import { getAppleMusicPlaylist, getTikTokVideo, getSpotifyPlaylist, getPinterestBoard } from "@/lib/party-media";

type Props = { pinterestUrl?: string | null; tiktokUrl?: string | null; tiktokUrls?: string[]; appleMusicUrl?: string | null; appleMusicUrls?: string[]; spotifyUrl?: string | null; spotifyUrls?: string[] };
export function PartyMedia({ pinterestUrl, tiktokUrl, tiktokUrls = [], appleMusicUrl, appleMusicUrls = [], spotifyUrl, spotifyUrls = [] }: Props) {
  const videos = [...new Set([tiktokUrl, ...tiktokUrls].filter((url): url is string => Boolean(url)))].map(getTikTokVideo).filter((video) => video !== null);
  const apples = [...new Set([appleMusicUrl, ...appleMusicUrls].filter((url): url is string => Boolean(url)))].map(getAppleMusicPlaylist).filter((playlist) => playlist !== null);
  const spotifys = [...new Set([spotifyUrl, ...spotifyUrls].filter((url): url is string => Boolean(url)))].map(getSpotifyPlaylist).filter((playlist) => playlist !== null);
  const board = getPinterestBoard(pinterestUrl);
  if (!videos.length && !apples.length && !spotifys.length && !board) return null;
  return <section aria-label="Party links and inspiration" className="grid min-w-0 gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
    {videos.map((video, index) => <article key={video.url} className="min-w-0 rounded-3xl border bg-white p-2 shadow-sm sm:p-4">
      <h2 className="mb-3 text-lg font-semibold">{videos.length > 1 ? `Party video ${index + 1}` : "Party video"}</h2>
      <iframe src={video.embedUrl} title={index ? `Party TikTok video ${index + 1}` : "Party TikTok video"} loading="lazy" allow="fullscreen; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="mx-auto aspect-[9/16] w-full max-w-[360px] rounded-2xl border-0" />
      <a href={video.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-primary underline">Open on TikTok</a>
      <p className="mt-1 text-xs text-muted-foreground">The video must be public and allow embedding.</p>
    </article>)}
    {apples.map((playlist, index) => <article key={playlist.url} className="min-w-0 rounded-3xl border bg-white p-2 shadow-sm sm:p-4">
      <h2 className="mb-3 text-lg font-semibold">Apple Music playlist</h2>
      <iframe src={playlist.embedUrl} title={index ? `Party Apple Music playlist ${index + 1}` : "Party Apple Music playlist"} loading="lazy" allow="encrypted-media; fullscreen" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation" className="h-[450px] w-full rounded-2xl border-0" />
      <a href={playlist.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-primary underline">Open in Apple Music</a>
      <p className="mt-1 text-xs text-muted-foreground">Public playlists show their artwork automatically. Apple Music controls preview availability.</p>
    </article>)}
    {spotifys.map((playlist, index) => <article key={playlist.url} className="min-w-0 rounded-3xl border bg-white p-2 shadow-sm sm:p-4">
      <h2 className="mb-3 text-lg font-semibold">Spotify playlist</h2>
      <iframe src={playlist.embedUrl} title={index ? `Party Spotify playlist ${index + 1}` : "Party Spotify playlist"} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowFullScreen className="h-[450px] w-full rounded-2xl border-0" />
      <a href={playlist.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-primary underline">Open in Spotify</a>
    </article>)}
    {board ? <article className="min-w-0 rounded-3xl border bg-white p-2 shadow-sm sm:p-4">
      <h2 className="mb-3 text-lg font-semibold">Pinterest mood board</h2>
      <iframe src={`/api/pinterest-board?url=${encodeURIComponent(board)}`} title="Party Pinterest mood board" loading="lazy" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" className="h-[450px] w-full rounded-2xl border-0" />
      <a href={board} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-primary underline">Open board on Pinterest</a>
    </article> : null}
  </section>;
}
