export const FIFA_CHANNEL_ID = 'UCpcTrCXblq78GZrTUTLWeBw';
export const FIFA_STREAMS_URL = 'https://www.youtube.com/@fifa/streams?hl=en';

// Read only JSON embedded by the official YouTube page; never execute page scripts.
export function pageJson(html, variable) {
  const marker = new RegExp(`(?:var\\s+${variable}|window\\["${variable}"\\]|${variable})\\s*=\\s*`);
  const match = marker.exec(html);
  if (!match) throw new Error('Official page format unavailable');
  const start = html.indexOf('{', match.index + match[0].length);
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i >= 0 && i < html.length; i++) {
    const char = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return JSON.parse(html.slice(start, i + 1));
  }
  throw new Error('Incomplete official page');
}

export function liveCandidates(page) {
  if (page.metadata?.channelMetadataRenderer?.externalId !== FIFA_CHANNEL_ID || !page.contents) {
    throw new Error('FIFA official channel could not be verified');
  }
  const ids = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    const renderer = value.videoRenderer || value.gridVideoRenderer;
    if (renderer && /^[\w-]{11}$/.test(renderer.videoId || '')) {
      const live = renderer.badges?.some((badge) => badge.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW')
        || renderer.thumbnailOverlays?.some((overlay) => overlay.thumbnailOverlayTimeStatusRenderer?.style === 'LIVE');
      if (live) ids.add(renderer.videoId);
    }
    // Newer YouTube layouts use lockupViewModel instead of videoRenderer.
    const lockup = value.lockupViewModel;
    if (lockup && /^[\w-]{11}$/.test(lockup.contentId || '')
      && /"(?:style|badgeStyle)":"[^"]*LIVE[^"]*"|"text":"LIVE"/.test(JSON.stringify(lockup))) ids.add(lockup.contentId);
    for (const child of Object.values(value)) walk(child);
  }
  walk(page.contents);
  return [...ids].slice(0, 8);
}

export function verifiedFifaMatch(player, videoId) {
  const video = player.videoDetails;
  const live = player.microformat?.playerMicroformatRenderer?.liveBroadcastDetails;
  if (video?.channelId !== FIFA_CHANNEL_ID || video.videoId !== videoId
    || live?.isLiveNow !== true || live.endTimestamp) return null;
  const title = video.title || '';
  // A live draw, press conference or gaming stream is not a live football match.
  if (/press conference|draw|congress|esports|efootball|fc pro/i.test(title)
    || !/\s(?:v(?:s)?\.?|versus|x|대)\s/i.test(title)) return null;
  const teams = title.split(/\s(?:v(?:s)?\.?|versus|x|대)\s/i);
  return {
    id: `fifa-${videoId}`, videoId, title: title.slice(0, 240),
    home: teams[0].replace(/^LIVE\s*[:|🔴-]*\s*/iu, '').slice(0, 80),
    away: teams[1].split('|')[0].trim().slice(0, 80),
    league: 'FIFA LIVE', venue: 'FIFA 공식 YouTube', status: 'live', matchTime: '공식 생중계',
    homeScore: '–', awayScore: '–',
    streamUrl: player.playabilityStatus?.status !== 'OK' || player.playabilityStatus?.playableInEmbed === false
      ? '' : `https://www.youtube-nocookie.com/embed/${videoId}`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    gameUrl: `https://www.youtube.com/watch?v=${videoId}`, source: 'fifa',
  };
}

export async function discoverFifaLive(fetchPage) {
  const page = pageJson(await fetchPage(FIFA_STREAMS_URL), 'ytInitialData');
  const candidates = liveCandidates(page);
  const results = await Promise.allSettled(candidates.map(async (id) => {
    const player = pageJson(await fetchPage(`https://www.youtube.com/watch?v=${id}&hl=en`), 'ytInitialPlayerResponse');
    if (!player.videoDetails || !player.microformat?.playerMicroformatRenderer?.liveBroadcastDetails) {
      throw new Error('Live video status could not be verified');
    }
    return verifiedFifaMatch(player, id);
  }));
  // An unverifiable candidate might be a live match: do not report an empty confirmed list.
  if (results.some((result) => result.status === 'rejected')) throw new Error('Live video verification unavailable');
  return results.map((result) => result.value).filter(Boolean);
}

// Prefer the supported Data API when the project's existing YouTube key is set.
// Playlist + videos lookups avoid the expensive search endpoint.
export async function discoverFifaLiveWithApi(fetchJson, key) {
  const get = (resource, params) => fetchJson(`https://www.googleapis.com/youtube/v3/${resource}?${new URLSearchParams({ ...params, key })}`);
  const channel = await get('channels', { part: 'contentDetails', id: FIFA_CHANNEL_ID });
  const official = channel.items?.find((item) => item.id === FIFA_CHANNEL_ID);
  const uploads = official?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error('Official channel uploads unavailable');
  const recent = await get('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: '50' });
  if (!Array.isArray(recent.items)) throw new Error('Official video list unavailable');
  const ids = recent.items.map((item) => item.contentDetails?.videoId).filter((id) => /^[\w-]{11}$/.test(id || ''));
  if (!ids.length) return [];
  const videos = await get('videos', { part: 'snippet,status,liveStreamingDetails', id: ids.join(',') });
  if (!Array.isArray(videos.items)) throw new Error('Official video statuses unavailable');
  return videos.items.flatMap((video) => {
    if (video.snippet?.liveBroadcastContent !== 'live' || !video.liveStreamingDetails?.actualStartTime
      || video.liveStreamingDetails.actualEndTime) return [];
    const match = verifiedFifaMatch({
      videoDetails: { videoId: video.id, channelId: video.snippet.channelId, title: video.snippet.title },
      microformat: { playerMicroformatRenderer: { liveBroadcastDetails: { isLiveNow: true } } },
      playabilityStatus: { status: 'OK', playableInEmbed: video.status?.embeddable === true },
    }, video.id);
    return match ? [match] : [];
  });
}
