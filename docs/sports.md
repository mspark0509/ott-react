# 스포츠 라이브

메인 메뉴 마지막의 **스포츠**(`/sports`)에서 경기를 선택하고 경기별 채팅에 참여합니다.

## 경기 정보와 중계

- ESPN 공개 축구 scoreboard API `https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard`에서 프리미어리그(`eng.1`), 라리가(`esp.1`), K리그1(`kor.1`)의 최근 7일~향후 14일 경기 정보를 30초마다 갱신합니다. API 키가 필요하지 않은 공개 엔드포인트이며 장기 제공·CORS·가용성은 보장되지 않습니다. 일부 리그 실패 시 안내하고, 전체 실패 시 재시도와 예시 경기를 표시합니다.
- 축구 시청 서비스: [쿠팡플레이](https://www.coupangplay.com), [FIFA+](https://www.plus.fifa.com/). 경기별 중계권, 로그인, 이용권, 지역 제한이 적용됩니다. 모든 경기의 중계나 앱 내 영상 재생을 보장하지 않습니다.
- 경기마다 ESPN 상세 링크를 제공합니다. 시작 시간은 한국 시간으로 표시하고, 홈팀을 먼저 표시합니다. 점수와 진행 시간, LIVE·예정·종료 상태가 반영됩니다.
- 실제 경기가 6개 미만이면 명확하게 **예시 경기**로 표시한 축구 카드로 화면을 보완합니다. 예시는 실제 일정·점수 또는 LIVE 중계로 표시하지 않으며 채팅을 열지 않습니다.
- 이용 허가가 있는 축구 중계는 Firestore `footballGames/{gameId}`에 등록합니다. ESPN 경기 ID는 `football-{leagueId}-{eventId}` 형식으로 등록하면 공개 데이터와 합쳐집니다. 별도 ID로 추가 축구 경기를 등록할 수도 있습니다.
- 기존 야구의 `sportsGames` 데이터·채팅은 삭제하지 않으며 축구 페이지에서는 읽지 않습니다. 축구만 별도 컬렉션으로 분리합니다.

문서 필드: `home`, `away`(문자열, 필수), `league`(`프리미어리그`/`라리가`/`K리그1`), `venue`, `status`(`live`/`scheduled`/`finished`), `matchTime`, `homeScore`, `awayScore`, `streamUrl`.

`streamUrl`은 HTTPS YouTube 임베드 URL(`https://www.youtube-nocookie.com/embed/VIDEO_ID` 또는 `www.youtube.com/embed/VIDEO_ID`)이나 `.mp4`, `.webm`, `.m3u8` 직접 스트림 URL을 지원합니다. YouTube는 업로더의 외부 재생 허용이 필요합니다. HLS는 브라우저 기본 지원이 필요하며 미지원 시 안내합니다. 서명 URL, CORS, 미디어 호스트 허용은 제공처에서 설정해야 합니다. 무단 재송출, 결제·DRM 우회는 구현하지 않습니다.

## 공유 채팅

기존 Firebase 프로젝트를 사용합니다. `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` 등 기존 Firebase 웹 설정을 환경에 제공하고 Vite를 재시작합니다. 값은 커밋하지 않습니다.

Firebase Authentication에서 Google 로그인을 활성화하고 실제 서비스 호스트를 Authorized domains에 추가합니다. Firestore를 활성화하고 [sports-firestore.rules](./sports-firestore.rules)의 scoped 규칙을 **기존 규칙과 병합**한 뒤 배포해야 합니다. 기존 광범위 `allow write: if true` 규칙이 있다면 먼저 제거/제한해야 합니다. 클라이언트에서 경기 문서 쓰기는 금지하고 관리 콘솔/서버에서만 등록합니다. 기존 사용자·찜 규칙을 덮어쓰지 마세요.

`footballGames/{gameId}/messages/{messageId}`에 `{uid, name, text, createdAt}`를 저장합니다. 로그인한 사용자가 최대 300자 메시지를 전송하며, 최신 100개 메시지를 `createdAt` 순으로 구독합니다. 경기 전환 시 이전 구독을 해제합니다. 전송 실패 시 입력 내용을 유지합니다. 표시 이름은 본인 인증 배지가 아닌 사용자 프로필 표시용입니다. 읽기는 공개이며 표시 이름·메시지도 공개됩니다.

운영 서비스에는 별도로 App Check, 서버 측 전송 빈도 제한, 신고·삭제 및 운영자 모니터링 정책을 구성하는 것을 권장합니다. 현재 UI의 중복 전송 방지와 Firestore 필드 검증은 서버 측 빈도 제한을 대체하지 않습니다.

## 검증과 로컬 개발

`npm run build`, `npx eslint src/pages/Sports.jsx src/features/sports/*.js src/features/sports/*.jsx src/firebase/firebase.js src/components/Header.jsx`, `node --test tests/sports.test.mjs`.

Firebase Auth/Firestore Emulator를 사용할 때만 개발 서버에 `VITE_FIREBASE_EMULATORS=true`를 지정합니다. localhost에서 개발 모드일 때만 Auth 9099, Firestore 8080에 연결합니다. 테스트에는 `demo-` 프로젝트를 사용하고 운영 데이터에 쓰지 마세요.

Firebase 설정이 없을 때에도 스포츠 페이지와 공개 경기 조회는 렌더링되며 채팅은 준비 중으로 표시합니다. API 연결 실패 시 이전 데이터의 최신성이 보장되지 않음을 알리고 재시도 버튼을 제공합니다. 설정 초안의 네트워크 허용 변경은 게시 전까지 현재 환경에 적용되지 않습니다.
