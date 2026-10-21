export const CACHE_MS = 5 * 60 * 1000;
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export class LiveError extends Error {
  constructor(code, status = 502) { super(code); this.code = code; this.status = status; }
}

export function classifyApiError(status, reason) {
  if (['quotaExceeded', 'dailyLimitExceeded', 'dailyLimitExceededUnreg'].includes(reason)) return new LiveError('quota_exceeded', 429);
  if ([400, 401, 403].includes(status)) return new LiveError('permission_denied', 403);
  return new LiveError('upstream_error');
}

export function youtubeClient(key, fetcher = fetch) {
  if (!key) throw new LiveError('key_missing', 503);
  const deadline = AbortSignal.timeout(24000);
  return async (resource, params) => {
    let response;
    try {
      response = await fetcher(`https://www.googleapis.com/youtube/v3/${resource}?${new URLSearchParams({ ...params, key })}`, { signal: AbortSignal.any([deadline, AbortSignal.timeout(10000)]) });
    } catch { throw new LiveError('network_error'); }
    let body;
    try { body = await response.json(); } catch { throw response.ok ? new LiveError('upstream_error') : classifyApiError(response.status); }
    if (!response.ok) throw classifyApiError(response.status, body.error?.errors?.[0]?.reason);
    return body;
  };
}

const excluded = /highlights?|하이라이트|다시\s?보기|리플레이|\breplay\b|full match replay|시뮬|simulation|simulator|\bgameplay\b|\bgaming\b|video game|mlb\s*(?:the\s*)?show|the show\s*\d|프로야구\s*스피리츠|컴투스|이사만루|9\s?innings|e-?baseball|ootp|\brbi baseball\b|\bnes\b|\bps[345]\b|\bxbox\b|중계석|입중계|문자\s?중계|해설|분석|예측|승부\s?예측|watch[ -]?along|reaction|commentary|analysis|predictions?|live[ -]?score|scoreboard|\bradio\b|audio only|talk show/i;
const baseball = /baseball|야구|\bwbsc\b|\bmlb\b|\bkbo\b|\bnpb\b|野球|棒球|béisbol|beisbol/i;
const matchup = /\s(?:v(?:s)?\.?|versus|대|x)\s|\b(?:game|match)\s*\d|경기|決勝|決赛|準決勝|준결승|결승/i;

export function verifiedBaseball(video, now = Date.now()) {
  const snippet = video.snippet || {}, live = video.liveStreamingDetails || {}, status = video.status || {};
  if (typeof snippet.title !== 'string' || typeof snippet.channelId !== 'string' || typeof snippet.channelTitle !== 'string') return null;
  if (!VIDEO_ID.test(video.id || '') || status.privacyStatus !== 'public' || status.embeddable !== true
    || snippet.liveBroadcastContent !== 'live' || !live.actualStartTime || live.actualEndTime
    || !Number.isFinite(Date.parse(live.actualStartTime)) || Date.parse(live.actualStartTime) > now) return null;
  // Conservative metadata screening: a title must describe baseball and a match.
  // Metadata alone cannot establish that a broadcaster owns the rights or what every frame shows.
  const title = snippet.title || '';
  if (/softball|소프트볼/i.test(title)) return null;
  if (/야구\s*게임|모바일\s*야구|super mega baseball|pro yakyuu|perfect inning|out of the park baseball|eスポーツ/i.test(title)) return null;
  if (excluded.test(`${title} ${snippet.channelTitle || ''}`) || !baseball.test(`${title} ${snippet.channelTitle || ''}`) || !matchup.test(title)) return null;
  const raw = live.concurrentViewers;
  const viewers = typeof raw === 'string' && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
  return { id: video.id, title: title.slice(0, 250), channelId: snippet.channelId, channelTitle: snippet.channelTitle,
    viewers, startedAt: live.actualStartTime, status: 'live',
    thumbnail: `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${video.id}` };
}

export function rankBroadcasts(games) {
  return [...games].sort((a, b) => (b.viewers ?? -1) - (a.viewers ?? -1) || a.id.localeCompare(b.id));
}

export async function videoDetails(client, ids) {
  const items = [];
  for (let start = 0; start < ids.length; start += 50) {
    const data = await client('videos', { part: 'snippet,status,liveStreamingDetails', id: ids.slice(start, start + 50).join(',') });
    if (!Array.isArray(data.items)) throw new LiveError('upstream_error');
    items.push(...data.items);
  }
  return items;
}

export async function searchBaseball(client, previousIds = []) {
  const ids = new Set();
  let pageToken, truncated = false;
  // Explicit ceiling protects quota. The UI identifies this as the discovered list,
  // not a claim that every worldwide baseball broadcast was enumerated.
  for (let page = 0; page < 3; page++) {
    const result = await client('search', { part: 'snippet', q: '야구|baseball', type: 'video', eventType: 'live',
      videoEmbeddable: 'true', maxResults: '50', order: 'viewCount', ...(pageToken ? { pageToken } : {}) });
    if (!Array.isArray(result.items)) throw new LiveError('upstream_error');
    for (const item of result.items) if (VIDEO_ID.test(item.id?.videoId || '')) ids.add(item.id.videoId);
    pageToken = result.nextPageToken;
    if (!pageToken) break;
    if (page === 2) truncated = true;
  }
  const videos = await videoDetails(client, [...new Set([...ids, ...previousIds])]);
  let wbscChannelId = null, wbscAvailable;
  try {
    const channels = await client('channels', { part: 'id,snippet', forHandle: 'WBSC' });
    wbscChannelId = channels.items?.[0]?.id || null;
    wbscAvailable = Boolean(wbscChannelId);
  } catch { wbscAvailable = false; }
  const games = rankBroadcasts(videos.filter((video) => ids.has(video.id)).map((video) => verifiedBaseball(video)).filter(Boolean));
  return { games, endedIds: videos.filter((video) => video.liveStreamingDetails?.actualEndTime).map((video) => video.id),
    wbscChannelId, wbscAvailable, truncated, checkedAt: new Date().toISOString() };
}

export function createLiveService({ getKey, fetcher = fetch, now = () => Date.now() }) {
  let cached, pending, cachedKey;
  return async () => {
    const key = getKey();
    if (!key) throw new LiveError('key_missing', 503);
    if (cachedKey !== key) { cached = undefined; cachedKey = key; }
    if (cached && now() - cached.time < CACHE_MS) return cached.value;
    if (pending) return pending;
    pending = searchBaseball(youtubeClient(key, fetcher), cached?.value.games.map((game) => game.id))
      .then((value) => { cached = { time: now(), value }; return value; }).finally(() => { pending = undefined; });
    return pending;
  };
}

export const errorMessages = {
  key_missing: 'YouTube 라이브 검색 설정이 없습니다. 관리자가 서버 환경변수를 설정해야 합니다.',
  permission_denied: 'YouTube API 키 권한 또는 API 사용 설정을 확인해야 합니다.',
  quota_exceeded: 'YouTube API의 조회 할당량을 초과했습니다. 할당량이 복구된 뒤 다시 시도해 주세요.',
  network_error: '라이브 제공처에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.',
  upstream_error: '라이브 제공처의 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
};

export function liveErrorResponse(error, response) {
  const code = error instanceof LiveError ? error.code : 'upstream_error';
  return response.status(error instanceof LiveError ? error.status : 502).json({ code, message: errorMessages[code] });
}
