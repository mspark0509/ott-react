import test from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_MS, LiveError, classifyApiError, createLiveService, rankBroadcasts, searchBaseball, verifiedBaseball, youtubeClient } from '../lib/baseball-live.js';

const id = 'Baseball001';
const fixture = (overrides = {}) => ({ id,
  snippet: { title: 'LIVE Baseball: Korea vs Japan', channelId: 'wbsc-id', channelTitle: 'WBSC', liveBroadcastContent: 'live' },
  status: { privacyStatus: 'public', embeddable: true },
  liveStreamingDetails: { actualStartTime: '2020-01-01T00:00:00Z', concurrentViewers: '301' }, ...overrides });

test('live validation excludes ended, scheduled, private, restricted, future and non-match videos', () => {
  assert.equal(verifiedBaseball(fixture()).viewers, 301);
  for (const details of [{ actualStartTime: 'start' }, { actualStartTime: '2099-01-01T00:00:00Z' }, { actualStartTime: '2020-01-01T00:00:00Z', actualEndTime: '2020-01-02T00:00:00Z' }, {}]) assert.equal(verifiedBaseball(fixture({ liveStreamingDetails: details })), null);
  assert.equal(verifiedBaseball(fixture({ status: { privacyStatus: 'private', embeddable: true } })), null);
  assert.equal(verifiedBaseball(fixture({ status: { privacyStatus: 'public', embeddable: false } })), null);
  for (const title of ['MLB The Show Baseball Korea vs Japan', 'Baseball simulation game 1', 'Baseball Korea vs Japan highlights', '야구 한국 대 일본 해설', '야구게임 한국 대 일본', 'Super Mega Baseball Korea vs Japan', 'Baseball Korea vs Japan commentary', '야구 분석 경기', 'Baseball Korea vs Japan live score', 'Baseball talk show', 'Football A vs B']) {
    const item = fixture(); item.snippet.title = title; item.snippet.channelTitle = 'Sports';
    assert.equal(verifiedBaseball(item), null, title);
  }
});
test('private viewer counts stay unknown while zero is a real count; ordering never invents viewers', () => {
  const unknown = fixture(); delete unknown.liveStreamingDetails.concurrentViewers;
  assert.equal(verifiedBaseball(unknown).viewers, null);
  const zero = fixture(); zero.liveStreamingDetails.concurrentViewers = '0';
  assert.equal(verifiedBaseball(zero).viewers, 0);
  assert.deepEqual(rankBroadcasts([{ id: 'a', viewers: null }, { id: 'b', viewers: 2 }, { id: 'c', viewers: 50 }]).map((v) => v.id), ['c', 'b', 'a']);
});
test('search uses the required live baseball constraints, videos verification and WBSC identity lookup', async () => {
  const requests = [];
  const result = await searchBaseball(async (resource, params) => {
    requests.push({ resource, params });
    if (resource === 'search') return { items: [{ id: { videoId: id } }, { id: { videoId: id } }] };
    if (resource === 'videos') return { items: [fixture()] };
    if (resource === 'channels') return { items: [{ id: 'wbsc-id' }] };
  });
  const query = requests[0].params;
  assert.equal(query.q, '야구|baseball');
  assert.equal(query.type, 'video'); assert.equal(query.eventType, 'live'); assert.equal(query.videoEmbeddable, 'true');
  assert.equal(result.games.length, 1);
  assert.equal(result.wbscChannelId, 'wbsc-id');
  assert.match(requests[1].params.part, /status/);
});
test('search pagination is bounded and reported, and channel lookup failure does not invent WBSC identity', async () => {
  let count = 0;
  const result = await searchBaseball(async (resource) => {
    if (resource === 'search') { count++; return { items: [], nextPageToken: 'next' }; }
    if (resource === 'channels') throw new Error('denied');
  });
  assert.equal(count, 3); assert.equal(result.truncated, true);
  assert.equal(result.wbscAvailable, false); assert.equal(result.wbscChannelId, null);
  assert.deepEqual(result.games, []);
});
test('key missing, permission, quota and network failures remain distinct and redact upstream secrets', async () => {
  assert.throws(() => youtubeClient(''), (error) => error.code === 'key_missing');
  assert.equal(classifyApiError(403, 'quotaExceeded').code, 'quota_exceeded');
  assert.equal(classifyApiError(403, 'forbidden').code, 'permission_denied');
  await assert.rejects(youtubeClient('fixture-only', async () => { throw new Error('sensitive endpoint'); })('search', {}), (error) => error.code === 'network_error' && !error.message.includes('sensitive'));
  await assert.rejects(youtubeClient('fixture-only', async () => ({ ok: false, status: 403, json: async () => ({ error: { errors: [{ reason: 'quotaExceeded' }] } }) }))('search', {}), (error) => error.code === 'quota_exceeded');
});
test('five-minute cache shares simultaneous searches and refreshes after expiry', async () => {
  let clock = 1000, searches = 0;
  const service = createLiveService({ getKey: () => 'fixture-only', now: () => clock, fetcher: async (url) => {
    const resource = new URL(url).pathname.split('/').at(-1);
    if (resource === 'search') searches++;
    return { ok: true, json: async () => resource === 'search' ? { items: [{ id: { videoId: id } }] }
      : resource === 'videos' ? { items: [fixture()] } : { items: [{ id: 'wbsc-id' }] } };
  } });
  const [first, second] = await Promise.all([service(), service()]);
  assert.equal(searches, 1); assert.deepEqual(first, second);
  clock += CACHE_MS - 1; await service(); assert.equal(searches, 1);
  clock += 2; await service(); assert.equal(searches, 2);
  assert.ok(new LiveError('network_error') instanceof Error);
});
