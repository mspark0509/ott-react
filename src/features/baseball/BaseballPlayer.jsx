import { useEffect, useRef, useState } from 'react';
import { loadYouTubePlayer } from '../sports/youtubePlayer';

export function BaseballPlayer({ video, availability }) {
  const host = useRef(null);
  const [playerState, setPlayerState] = useState('connecting');
  const [broadcastState, setBroadcastState] = useState('live');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const ended = availability === 'ended' || broadcastState === 'ended' || playerState === 'ended';
  const playable = availability === 'live' && broadcastState === 'live' && !ended;
  useEffect(() => {
    if (!playable) return;
    let active = true, player;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${video.id}?${new URLSearchParams({ enablejsapi: '1', origin: window.location.origin, playsinline: '1', rel: '0' })}`;
    iframe.title = video.title;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    host.current.replaceChildren(iframe);
    loadYouTubePlayer().then((YT) => {
      if (!active) return;
      player = new YT.Player(iframe, { events: {
        onReady: () => { if (active) { setPlayerState('ready'); player.mute(); player.playVideo(); } },
        onStateChange: (event) => {
          if (!active) return;
          if (event.data === 1) { setPlayerState('playing'); setError(''); }
          else if (event.data === 0) setPlayerState('ended');
          else if (event.data === 2) setPlayerState('paused');
        },
        onAutoplayBlocked: () => { if (active) setPlayerState('ready'); },
        onError: (event) => {
          if (!active) return;
          setPlayerState('error');
          setError([101, 150].includes(event.data) ? '이 방송은 현재 외부 재생이 제한되어 있습니다.'
            : event.data === 100 ? '삭제·비공개 또는 현재 이용할 수 없는 영상입니다.' : '재생 요청을 처리하지 못했습니다. 지역 제한이나 브라우저 설정을 확인해 주세요.');
        },
      } });
    }).catch(() => { if (active) setWarning('재생 상태 확인에 실패했습니다. 플레이어에서 직접 재생할 수 있으며 원본 링크도 이용할 수 있습니다.'); });
    return () => { active = false; player?.destroy(); iframe.remove(); };
  }, [video.id, video.title, playable, attempt]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function check() {
      try {
        const response = await fetch(`/api/baseball-status?id=${video.id}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(28000)]), cache: 'no-store' });
        if (!response.ok) throw new Error('Status unavailable');
        const result = await response.json();
        if (active && ['live', 'ended', 'unavailable'].includes(result.state)) setBroadcastState(result.state);
      } catch { if (active) setWarning('현재 방송 상태를 다시 확인하지 못했습니다. 마지막 목록 조회 시각을 확인해 주세요.'); }
    }
    check();
    const timer = setInterval(check, 300000);
    return () => { active = false; clearInterval(timer); controller.abort(); };
  }, [video.id, attempt]);
  const labels = { connecting: '플레이어 연결 중', ready: '재생 버튼을 눌러주세요', playing: '영상 재생 중', paused: '일시 정지', error: '재생 오류' };
  return <section className="sports-watch" aria-label="선택한 야구 방송">
    {playable ? <div className="sports-video" ref={host} /> : <div className="sports-video baseball-unavailable" role="status"><span>⚾</span><h2>{ended ? '방송이 종료되었습니다' : '현재 방송 상태를 확인할 수 없습니다'}</h2><p>녹화 영상을 실시간 중계로 재생하지 않습니다. 다른 라이브 방송을 선택해 주세요.</p></div>}
    <div className="sports-watch-info"><span className="sports-badge">{ended ? '방송 종료' : !playable ? '상태 확인 필요' : labels[playerState]}</span>
      <h2>{video.title}</h2><p>{video.channelTitle} · {video.viewers === null ? '동시 시청자 수 비공개' : `조회 시점 동시 시청자 ${video.viewers.toLocaleString('ko-KR')}명`}</p>
      {error && <p role="alert" className="sports-error">{error}</p>}{warning && <p role="status">{warning}</p>}
      <div className="sports-channel-actions"><a className="sports-primary" href={video.watchUrl} target="_blank" rel="noopener noreferrer">YouTube 원본 방송 ↗</a>
        {playable && <button className="sports-primary" onClick={() => { setPlayerState('connecting'); setError(''); setWarning(''); setAttempt((value) => value + 1); }}>재생 다시 연결</button>}</div>
      <p>공개·라이브·임베드 허용 상태와 제목을 확인한 검색 결과입니다. 실제 경기 영상인지와 중계 권한은 제공처에서 최종 확인해 주세요.</p>
    </div>
  </section>;
}
