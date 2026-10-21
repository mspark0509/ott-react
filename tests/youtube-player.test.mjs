import test from 'node:test';
import assert from 'node:assert/strict';
import { fifaChannelEmbed, fifaChannelRoom, youtubeErrorMessage } from '../src/features/sports/youtubePlayer.js';

test('official FIFA channel player connects without a video search API', () => {
  const url = new URL(fifaChannelEmbed('https://ott-react-inky.vercel.app'));
  assert.equal(url.origin, 'https://www.youtube.com');
  assert.equal(url.pathname, '/embed/live_stream');
  assert.equal(url.searchParams.get('channel'), 'UCpcTrCXblq78GZrTUTLWeBw');
  assert.equal(url.searchParams.get('enablejsapi'), '1');
  assert.equal(url.searchParams.get('origin'), 'https://ott-react-inky.vercel.app');
  assert.equal(fifaChannelRoom.id, 'fifa-channel');
  assert.notEqual(fifaChannelRoom.status, 'live');
});
test('playback restriction and absent broadcasts are actionable distinct errors', () => {
  assert.match(youtubeErrorMessage(101), /외부 재생/);
  assert.match(youtubeErrorMessage(150), /공식 YouTube/);
  assert.match(youtubeErrorMessage(100), /방송 종료/);
  assert.match(youtubeErrorMessage(153), /재생 요청/);
  assert.match(youtubeErrorMessage(5), /네트워크/);
});
