/** Only provider URLs are accepted; embed HTML is never stored or executed. */
function httpsUrl(value: string | null | undefined): URL | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url : null;
  } catch { return null; }
}

export function getTikTokVideo(value?: string | null) {
  const url = httpsUrl(value);
  if (!url || !["tiktok.com", "www.tiktok.com", "m.tiktok.com"].includes(url.hostname)) return null;
  const match = url.pathname.match(/^\/@[\w.-]+\/video\/(\d{10,25})\/?$/);
  if (!match) return null;
  return {
    url: `https://www.tiktok.com${url.pathname.replace(/\/$/, "")}`,
    embedUrl: `https://www.tiktok.com/player/v1/${match[1]}?autoplay=0&controls=1&description=1&music_info=1`
  };
}

export function isTikTokShareUrl(value: string) {
  const url = httpsUrl(value);
  if (!url) return false;
  return (["vm.tiktok.com", "vt.tiktok.com"].includes(url.hostname) && /^\/[a-zA-Z0-9]+\/?$/.test(url.pathname)) ||
    (["tiktok.com", "www.tiktok.com"].includes(url.hostname) && /^\/t\/[a-zA-Z0-9]+\/?$/.test(url.pathname));
}

export function getAppleMusicPlaylist(value?: string | null) {
  const url = httpsUrl(value);
  if (!url || !["music.apple.com", "embed.music.apple.com"].includes(url.hostname)) return null;
  if (!/^\/[a-z]{2}\/playlist\/(?:[^/]+\/)?pl\.[a-zA-Z0-9.-]+\/?$/.test(url.pathname)) return null;
  const path = url.pathname.replace(/\/$/, "");
  return {
    url: `https://music.apple.com${path}`,
    embedUrl: `https://embed.music.apple.com${path}?theme=auto`
  };
}

export function getSpotifyPlaylist(value?: string | null) {
  const url = httpsUrl(value);
  if (!url || url.hostname !== "open.spotify.com") return null;
  const match = url.pathname.match(/^\/(?:intl-[a-z]{2}\/)?(?:embed\/)?playlist\/([a-zA-Z0-9]{22})\/?$/);
  if (!match) return null;
  return { url: `https://open.spotify.com/playlist/${match[1]}`, embedUrl: `https://open.spotify.com/embed/playlist/${match[1]}` };
}

export function getPinterestBoard(value?: string | null) {
  const url = httpsUrl(value);
  if (!url || !["www.pinterest.com", "pinterest.com"].includes(url.hostname)) return null;
  const match = url.pathname.match(/^\/([a-zA-Z0-9_]{3,30})\/([^/]+)\/?$/);
  if (!match || ["pin", "search", "ideas", "settings", "login", "signup", "today"].includes(match[1].toLowerCase()) || ["_saved", "_created"].includes(match[2].toLowerCase())) return null;
  return `https://www.pinterest.com/${match[1]}/${match[2]}/`;
}
