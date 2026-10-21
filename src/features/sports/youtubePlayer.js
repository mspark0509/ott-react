export const FIFA_CHANNEL_ID = 'UCpcTrCXblq78GZrTUTLWeBw';
export const fifaChannelRoom = { id: 'fifa-channel', status: 'channel', home: 'FIFA', away: '공식 채널', league: 'FIFA 채널' };

export function fifaChannelEmbed(origin) {
  const url = new URL('https://www.youtube.com/embed/live_stream');
  url.search = new URLSearchParams({ channel: FIFA_CHANNEL_ID, enablejsapi: '1', playsinline: '1', origin }).toString();
  return url.href;
}

let apiPromise;
export function loadYouTubePlayer() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    let settled = false;
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = setTimeout(() => fail(), 15000);
    function fail() {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      apiPromise = undefined;
      document.getElementById('sports-youtube-api')?.remove();
      reject(new Error('YouTube player unavailable'));
    }
    window.onYouTubeIframeAPIReady = () => {
      settled = true;
      clearTimeout(timeout);
      resolve(window.YT);
      if (typeof previous === 'function') previous();
    };
    let script = document.getElementById('sports-youtube-api');
    if (!script) {
      script = document.createElement('script');
      script.id = 'sports-youtube-api';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.addEventListener('error', fail, { once: true });
      document.head.append(script);
    }
  });
  return apiPromise;
}

export function youtubeErrorMessage(code) {
  if (code === 101 || code === 150) return 'FIFA가 이 영상의 외부 재생을 허용하지 않았습니다. 공식 YouTube에서 시청해 주세요.';
  if (code === 100) return '현재 채널에서 재생 가능한 생중계를 찾을 수 없습니다. 방송 종료·비공개 상태일 수 있습니다.';
  if (code === 153) return 'YouTube가 사이트의 재생 요청을 확인하지 못했습니다. 공식 YouTube에서 시청하거나 브라우저 설정을 확인해 주세요.';
  return '영상을 재생하지 못했습니다. 현재 방송 여부·지역 제한·네트워크 연결을 공식 채널에서 확인해 주세요.';
}
