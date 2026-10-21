import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { addDoc, collection, limitToLast, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../../firebase/firebase';

export function GameChat({ game, roomCollection = 'footballGames', sportName = '축구', icon = '⚽' }) {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [loginPending, setLoginPending] = useState(false);
  const end = useRef(null);
  const enabled = Boolean(db && game.status !== 'demo');

  useEffect(() => auth ? onAuthStateChanged(auth, setUser) : undefined, []);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(query(collection(db, roomCollection, game.id, 'messages'), orderBy('createdAt'), limitToLast(100)), { includeMetadataChanges: true },
      (snapshot) => {
        setMessages(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
        setConnected(!snapshot.metadata.fromCache);
        setError('');
      }, () => {
        setConnected(false);
        setError('채팅에 연결하지 못했습니다. 연결 상태를 확인하거나 잠시 후 다시 접속해 주세요.');
      });
  }, [enabled, game.id, roomCollection]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);

  async function login() {
    setLoginPending(true);
    try { await signInWithPopup(auth, googleProvider); setError(''); }
    catch { setError('로그인하지 못했습니다. 팝업 허용과 로그인 설정을 확인해 주세요.'); }
    finally { setLoginPending(false); }
  }
  async function send(event) {
    event.preventDefault();
    const body = text.trim();
    if (!user || !enabled || !connected || sending || !body || body.length > 300) return;
    setSending(true);
    try {
      await addDoc(collection(db, roomCollection, game.id, 'messages'), {
        uid: user.uid, name: (user.displayName || `${sportName} 팬`).slice(0, 40), text: body, createdAt: serverTimestamp(),
      });
      setText(''); setError('');
    } catch { setError('메시지를 보내지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.'); }
    finally { setSending(false); }
  }

  return <aside className="sports-chat" aria-label="경기 실시간 채팅">
    <div className="sports-chat-heading"><h2>함께 응원해요 <span>LIVE CHAT</span></h2>
      <p>{connected ? '● 실시간 연결됨' : '연결 대기'} · {game.status === 'channel' ? 'FIFA 채널 공용 응원방' : user ? `${user.displayName || `${sportName} 팬`}님 응원방` : '방송별 응원방'}</p></div>
    <div className="sports-chat-messages" role="log" aria-label="응원 메시지" aria-live="polite">
      <p className="sports-chat-notice">서로를 존중하며 응원해 주세요. 개인정보와 불법 중계 링크는 공유하지 마세요.</p>
      {!messages.length && <div className="sports-chat-empty"><span>{icon}</span><p>{enabled ? '첫 응원 메시지를 남겨보세요!' : game.status === 'demo' ? '공식 경기가 등록되면 응원방이 열립니다.' : '응원방 연결을 준비하고 있습니다.'}</p></div>}
      {messages.map((message) => <div className={`sports-message ${message.uid === user?.uid ? 'is-mine' : ''}`} key={message.id}>
        <div><strong>{typeof message.name === 'string' ? message.name : `${sportName} 팬`}</strong>
          {message.uid === user?.uid && <span> 나</span>}
          <time>{message.createdAt?.toDate?.().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) || '전송 중'}</time></div>
        <p>{typeof message.text === 'string' ? message.text : ''}</p>
      </div>)}<div ref={end} />
    </div>
    <div className="sports-chat-compose">
      {error && <p role="alert" className="sports-error">{error}</p>}
      {!enabled ? <p className="sports-muted">{game.status === 'demo' ? '현재는 예시 경기입니다. 실제 경기에서 채팅에 참여할 수 있어요.' : '실시간 채팅 연결을 준비 중입니다. 영상 재생은 별도로 이용할 수 있습니다.'}</p>
        : !user ? <button className="sports-primary" onClick={login} disabled={loginPending}>{loginPending ? '로그인 중…' : 'Google 로그인하고 응원하기'}</button>
          : <form onSubmit={send}><label htmlFor="sports-message">응원 메시지 <span>{text.length}/300</span></label>
            <div><input id="sports-message" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="응원 한마디를 남겨주세요" disabled={!connected || sending} />
              <button className="sports-primary" disabled={!connected || sending || !text.trim()}>{sending ? '전송 중' : '전송'}</button></div></form>}
    </div>
  </aside>;
}
