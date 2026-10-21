import { useEffect, useRef, useState } from 'react';
import { fifaChannelEmbed, loadYouTubePlayer, youtubeErrorMessage } from './youtubePlayer';

export function FifaChannelPlayer() {
  const host = useRef(null);
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let player;
    const frame = document.createElement('iframe');
    frame.src = fifaChannelEmbed(window.location.origin);
    frame.title = 'FIFA 공식 채널 현재 방송 직접 재생';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    host.current.replaceChildren(frame);
    loadYouTubePlayer().then((YT) => {
      if (!active) return;
      player = new YT.Player(frame, { events: {
        onReady: () => { if (active) { setState('ready'); player.mute(); player.playVideo(); } },
        onStateChange: (event) => {
          if (!active) return;
          if (event.data === 1) { setState('playing'); setMessage(''); }
          else if (event.data === 2) setState('paused');
          else if (event.data === 0) setState('ended');
          else if (event.data === 3) setState('buffering');
        },
        onAutoplayBlocked: () => { if (active) setState('ready'); },
        onError: (event) => { if (active) { setState('error'); setMessage(youtubeErrorMessage(event.data)); } },
      } });
    }).catch(() => {
      // The iframe can still play without the optional JavaScript status API.
      if (active) { setState('unknown'); setMessage('재생 상태를 확인하지 못했습니다. 플레이어에서 직접 재생하거나 공식 채널에서 확인해 주세요.'); }
    });
    return () => { active = false; player?.destroy(); frame.remove(); };
  }, [attempt]);

  const labels = { loading: '공식 채널 연결 중', ready: '플레이어에서 재생을 눌러주세요', playing: '영상 재생 중',
    paused: '일시 정지', ended: '재생 종료', buffering: '영상 버퍼링 중', error: '재생 불가', unknown: '재생 상태 확인 필요' };
  return <section className="sports-watch sports-channel-watch" aria-label="FIFA 공식 채널 직접 시청">
    <div className="sports-video" ref={host} />
    <div className="sports-watch-info">
      <div><span className={`sports-badge ${state === 'playing' ? 'playing' : ''}`}>{labels[state]}</span><span>FIFA 공식 채널 직접 연결</span></div>
      <h2>FIFA 공식 채널 현재 방송</h2>
      <p>영상 검색 결과와 관계없이 공식 채널에 직접 연결합니다. 현재 방송이 있고 외부 재생이 허용된 경우 시청할 수 있습니다. 경기·방송 여부가 미리 확인된 영상은 아닙니다.</p>
      {message && <p role="status" className="sports-channel-message">{message}</p>}
      <div className="sports-channel-actions"><button className="sports-primary" onClick={() => { setState('loading'); setMessage(''); setAttempt((value) => value + 1); }}>채널 다시 연결</button>
        <a className="sports-source-link" href="https://www.youtube.com/@fifa/live" target="_blank" rel="noopener noreferrer">FIFA 공식 채널에서 시청 ↗</a></div>
      <p>오른쪽은 FIFA 채널 공용 응원방입니다. 특정 경기의 채팅은 해당 경기 카드를 선택해 주세요.</p>
    </div>
  </section>;
}
