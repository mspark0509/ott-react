import test from 'node:test';
import assert from 'node:assert/strict';
import { FIFA_CHANNEL_ID, discoverFifaLive, discoverFifaLiveWithApi, liveCandidates, pageJson, verifiedFifaMatch } from '../lib/fifa-live.js';
import handler from '../api/fifa-live.js';

const id = 'abcdefghijk';
const channel = {
  metadata: { channelMetadataRenderer: { externalId: FIFA_CHANNEL_ID } },
  contents: { videoRenderer: { videoId: id, badges: [{ metadataBadgeRenderer: { style: 'BADGE_STYLE_TYPE_LIVE_NOW' } }] } },
};
function player() {
  return { videoDetails: { videoId: id, channelId: FIFA_CHANNEL_ID, title: 'LIVE: Korea Republic v Japan | FIFA tournament' },
    microformat: { playerMicroformatRenderer: { liveBroadcastDetails: { isLiveNow: true } } },
    playabilityStatus: { status: 'OK', playableInEmbed: true } };
}
test('extract page JSON without executing scripts or mistaking braces inside strings', () => {
  assert.deepEqual(pageJson('var ytInitialData = {"title":"test } \\\" {","nested":{}};danger()', 'ytInitialData'), { title: 'test } " {', nested: {} });
  assert.throws(() => pageJson('consent required', 'ytInitialData'));
});
test('live candidates must belong to the verified official FIFA channel', () => {
  assert.deepEqual(liveCandidates(channel), [id]);
  assert.throws(() => liveCandidates({ ...channel, metadata: {} }));
  assert.deepEqual(liveCandidates({ ...channel, contents: { videoRenderer: { videoId: id } } }), []);
});
test('only currently live official football matches become playable games', () => {
  const video = player();
  assert.equal(verifiedFifaMatch(video, id).streamUrl, `https://www.youtube-nocookie.com/embed/${id}`);
  const ended = player(); ended.microformat.playerMicroformatRenderer.liveBroadcastDetails.endTimestamp = '2026-10-21T00:00:00Z';
  assert.equal(verifiedFifaMatch(ended, id), null);
  const replay = player(); replay.microformat.playerMicroformatRenderer.liveBroadcastDetails.isLiveNow = false;
  assert.equal(verifiedFifaMatch(replay, id), null);
  const unofficial = player(); unofficial.videoDetails.channelId = 'unofficial';
  assert.equal(verifiedFifaMatch(unofficial, id), null);
  const conference = player(); conference.videoDetails.title = 'LIVE: World Cup draw';
  assert.equal(verifiedFifaMatch(conference, id), null);
  const restricted = player(); restricted.playabilityStatus.playableInEmbed = false;
  assert.equal(verifiedFifaMatch(restricted, id).streamUrl, '');
});
test('official discovery verifies each live candidate and distinguishes empty from failure', async () => {
  const pages = async (url) => url.includes('/streams') ? `var ytInitialData = ${JSON.stringify(channel)};`
    : `var ytInitialPlayerResponse = ${JSON.stringify(player())};`;
  assert.equal((await discoverFifaLive(pages))[0].id, `fifa-${id}`);
  await assert.rejects(() => discoverFifaLive(async () => 'blocked'));
  const empty = { ...channel, contents: {} };
  assert.deepEqual(await discoverFifaLive(async () => `var ytInitialData = ${JSON.stringify(empty)};`), []);
  await assert.rejects(() => discoverFifaLive(async (url) => {
    if (url.includes('/streams')) return `var ytInitialData = ${JSON.stringify(channel)};`;
    throw new Error('upstream denied');
  }));
});
test('API rejects writes and reports upstream failure rather than no live games', async () => {
  const result = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST' }, result);
  assert.equal(result.code, 405);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('blocked'); };
    await handler({ method: 'GET' }, result);
    assert.equal(result.code, 502);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(result.body.games, undefined);
  } finally { globalThis.fetch = originalFetch; }
});

test('YouTube Data API verifies official ownership, actual start/end and embedding permission', async () => {
  const video = (videoId, overrides = {}) => ({ id: videoId,
    snippet: { title: 'Korea v Japan | FIFA', channelId: FIFA_CHANNEL_ID, liveBroadcastContent: 'live' },
    liveStreamingDetails: { actualStartTime: '2026-10-21T00:00:00Z' }, status: { embeddable: true }, ...overrides });
  const games = await discoverFifaLiveWithApi(async (url) => {
    if (url.includes('/channels?')) return { items: [{ id: FIFA_CHANNEL_ID, contentDetails: { relatedPlaylists: { uploads: 'official-uploads' } } }] };
    if (url.includes('/playlistItems?')) return { items: [{ contentDetails: { videoId: id } }] };
    return { items: [video(id), video('ended123456', { liveStreamingDetails: { actualStartTime: 'start', actualEndTime: 'end' } }),
      video('fake1234567', { snippet: { title: 'Korea v Japan', channelId: 'unofficial', liveBroadcastContent: 'live' } }),
      video('limited1234', { status: { embeddable: false } })] };
  }, 'test-key');
  assert.equal(games.length, 2);
  assert.equal(games[0].streamUrl, `https://www.youtube-nocookie.com/embed/${id}`);
  assert.equal(games[1].streamUrl, '');
});
