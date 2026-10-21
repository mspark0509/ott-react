# 야구 라이브 개발·검증·배포

## 경로와 기존 기능

메인 메뉴 마지막은 **축구 → 야구**입니다. 기존 축구 화면·FIFA 플레이어·채팅은 `/football`에서 유지합니다. `/sports`는 야구 화면이며 `/baseball`은 `/sports`로 이동합니다. 영화·프로필·찜·기존 Google 인증과 Firebase 프로젝트는 유지합니다. 두 메뉴를 만들라는 구체적인 요청에 맞춰 별도 중복 ‘스포츠’ 메뉴는 추가하지 않았습니다.

## 데이터 출처와 확인 범위

- 사용 API: [YouTube search.list](https://developers.google.com/youtube/v3/docs/search/list), [videos.list](https://developers.google.com/youtube/v3/docs/videos/list), [channels.list](https://developers.google.com/youtube/v3/docs/channels/list).
- 실제로 읽어 확인한 공식 명세: Google의 [YouTube v3 discovery JSON](https://raw.githubusercontent.com/googleapis/google-api-nodejs-client/main/discovery/youtube-v3.json). `eventType=live`, `videoEmbeddable=true`, `VideoStatus.privacyStatus/embeddable`, `VideoLiveStreamingDetails.actualStartTime/actualEndTime/concurrentViewers`, `channels.list.forHandle` 필드를 확인했습니다.
- WBSC 기준은 [@WBSC](https://www.youtube.com/@WBSC) 핸들의 `channels.list` 응답 ID입니다. 채널 표시 이름이 비슷하다는 이유로 공식 방송으로 취급하지 않습니다. 식별 조회 실패 시 필터를 비활성화합니다. WBSC 홈페이지는 <https://www.wbsc.org/>입니다. 현재 환경에서 홈페이지와 실제 API 요청은 프록시 403으로 차단되어 현시점 WBSC ID·실제 방송은 확인하지 못했습니다.

`api/baseball-live.js`는 서버에서 `q=야구|baseball`, `type=video`, `eventType=live`, `videoEmbeddable=true`, `order=viewCount`로 검색하고 `videos.list(part=snippet,status,liveStreamingDetails)`로 공개 여부, 임베드 허용, 실제 시작·종료, 현재 라이브 상태를 다시 검증합니다. 게임·시뮬레이션·하이라이트·해설·분석·스코어보드·오디오 방송 등 명확한 제목은 제외합니다. 야구와 대진/경기를 가리키는 제목만 보수적으로 채택합니다. 제목·메타데이터만으로 경기 영상 여부나 중계 권한을 완전히 증명할 수는 없습니다.

최대 3페이지/150개 검색 후보를 확인합니다. 추가 페이지가 남으면 UI에 검색 범위 제한을 표시합니다. ‘전체 라이브’는 이 범위에서 검증된 전체 목록이며 세계의 모든 방송을 수집했다는 뜻은 아닙니다. 조회 비용을 제한하며, 결과가 적어도 예시 방송으로 채우지 않습니다.

동시 시청자 수가 공개된 방송만 TOP 5(실제 개수만큼)에 포함합니다. 시청자 수 비공개는 `null`로 유지하고 ‘비공개’로 표시하며 0명을 만들어 넣지 않습니다. 실제 0명은 0명으로 표시합니다. 숫자는 조회 시점 값입니다.

서버 메모리 캐시와 동시 요청 병합, Vercel CDN 캐시는 최대 5분입니다. CDN TTL은 원본 조회 시각으로 남은 시간을 계산해 중복 캐시로 오래된 결과가 연장되지 않게 합니다. 브라우저도 5분마다 갱신합니다. 새로고침 버튼도 서버 캐시를 우회하지 않습니다. 서버리스 인스턴스가 여러 개이면 각 인스턴스/캐시 위치에서 별도 검색할 수 있습니다. YouTube 검색 API는 비용이 크므로 프로젝트별 쿼터를 확인해야 합니다. 할당량 초과는 별도 상태로 표시하며 검증을 생략하지 않습니다.

`api/baseball-status.js?id={videoId}`는 선택된 방송 상태를 저비용 `videos.list`로 다시 확인합니다. YouTube Player의 재생 종료 이벤트나 실제 종료 응답이 오면 플레이어를 제거하고 종료 안내를 표시합니다. 목록에서 사라지기만 한 방송은 종료라고 단정하지 않고 상태 확인 필요로 표시합니다. 지역·외부 재생 제한 시 원본 영상 링크를 제공합니다. 채널 주소만 넣은 대체 플레이어는 야구 화면에 없습니다.

## 설정

Node 24.19.0, npm 11.9.0에서 확인했습니다. 작업마다 이미 격리된 체크아웃 `/workspace/ott-react`를 사용하며 별도 Git worktree를 만들지 않습니다.

서버의 `YOUTUBE_API_KEY`를 우선 사용하고 기존 `VITE_YOUTUBE_API_KEY`가 있으면 재사용합니다. 현재 클라우드에서는 기존 키와 Firebase 설정이 존재함을 확인했지만 API 접근이 차단되어 사용 가능 여부는 미확인입니다. 키 값을 채팅·Git·로그로 전달하지 마세요. 새로 설정할 때는 서버 전용 `YOUTUBE_API_KEY`에 안전한 환경 설정으로 입력하고 YouTube Data API v3를 활성화합니다. 브라우저 HTTP referrer만 허용된 키는 서버 요청에서 거부될 수 있습니다. 새 키가 필요하다고 단정하거나 기존 바인딩을 중복 생성하지 마세요.

기존 `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`와 기타 Firebase 웹 설정을 사용합니다. Google Auth와 서비스 도메인 승인, Firestore 활성화가 필요합니다. Vite 변수 변경은 개발 서버 재시작·프로덕션 재빌드가 필요합니다. 서버 변수 변경은 Vercel 환경 설정에 적용하고 다시 배포해야 합니다. 클라우드 환경 변수와 Vercel 환경 변수는 별개입니다.

필요 목적지: `www.googleapis.com`, `www.youtube.com`, `www.youtube-nocookie.com`, `i.ytimg.com`, `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, 설정된 Firebase 인증 도메인. 검증 문서·에뮬레이터 다운로드에는 `developers.google.com`, `www.wbsc.org`, `storage.googleapis.com`도 사용합니다. 허용 도메인 초안을 저장하는 것만으로 실행 중 네트워크 정책이 바뀌지는 않습니다.

## 채팅과 규칙

`baseballBroadcasts/{11자리 videoId}/messages/{messageId}`를 구독합니다. 기존 Firebase Google 로그인을 재사용하고, 최신 100개를 `createdAt` 순으로 `onSnapshot` 구독합니다. 방송 전환 시 플레이어와 채팅 컴포넌트를 각각 고유 key로 교체하고 이전 구독을 해제합니다. 최대 300자, 서버 시각, 전송 상태, 실패 시 입력 유지와 오류 안내를 제공합니다. 채팅 읽기와 이름·메시지는 공개입니다.

`includeMetadataChanges`를 사용해 로컬 캐시 스냅샷과 서버 확인을 구분하며, `fromCache=false`인 응답을 받은 경우에만 실시간 연결됨으로 표시합니다. 연결 대기·오프라인에서는 전송 버튼을 비활성화합니다.

[baseball-firestore.rules](./baseball-firestore.rules)를 **실제 기존 `/databases/{database}/documents` 규칙 안에 병합**해야 합니다. 기존 users·likes·footballGames 규칙 파일을 교체하지 않습니다. 인증 사용자 UID와 발신 UID 일치, 필드 목록·자료형·길이·서버 시각, 영상 ID 형식, 수정·삭제 금지를 검증합니다. 기존에 광범위 `allow write: if true`가 있으면 OR 조건으로 보호를 무력화할 수 있어 전체 실제 규칙 검토가 필요합니다. 클라이언트에 운영자 권한을 부여하지 않습니다. 운영 규칙은 읽거나 배포하지 못했으므로 적용 완료라고 주장하지 않습니다.

## 실행과 검증

```bash
cd /workspace/ott-react
npm ci --cache /workspace/.npm --no-audit --no-fund
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

의미 있는 기본 검사:

```bash
npm run build
node --test tests/*.test.mjs
npx eslint src/App.jsx src/components/Header.jsx src/store/useAuthStore.js src/features/baseball/*.js src/features/baseball/*.jsx src/features/sports/GameChat.jsx src/pages/Baseball.jsx api/baseball*.js lib/baseball-live.js vite.config.js
git diff --check
```

기본 테스트는 모의 YouTube 응답에 대한 라이브 판별·오류 구분·시청자 수·검색 조건·페이지 제한·5분 캐시를 검증합니다. 실제 API 성공을 증명하지 않습니다. 기존 전체 린트에는 이 변경과 별개인 오류가 남아 있습니다.

테스트 전용 도구는 저장소 의존성을 바꾸지 않고 별도 경로에 설치할 수 있습니다:

```bash
npm install --prefix /tmp/ott-sports-browser --cache /workspace/.npm --no-package-lock --no-audit --no-fund playwright@1.64.1 firebase-tools@15.34.0 @firebase/rules-unit-testing@6.0.0 firebase@13.0.0
BASEBALL_TEST_DEPS=/tmp/ott-sports-browser node tests/browser/baseball.browser.mjs
```

브라우저 테스트는 로컬 서버·Chromium(`/usr/bin/chromium`, `CHROMIUM_PATH`로 변경 가능)을 사용합니다. API·영상 플레이어를 모의 처리하여 메뉴·TOP5·실제 개수·필터·영상/채팅 전환 정리·5분 갱신·종료·각 오류·모바일·직접 접속/새로고침을 검증합니다. Firebase 트래픽은 차단하며, 운영 영상 재생이나 실제 채팅 송수신을 증명하지 않습니다.

두 사용자와 보안 규칙은 별도 Firestore 에뮬레이터에서 검사합니다(Java 21 필요):

```bash
node scripts/prepare-baseball-emulator.mjs
BASEBALL_TEST_DEPS=/tmp/ott-sports-browser XDG_CONFIG_HOME=/tmp/ott-firebase-config FIREBASE_EMULATORS_PATH=/tmp/ott-firebase-cache /tmp/ott-sports-browser/node_modules/.bin/firebase emulators:exec --only firestore --project demo-ott-baseball --config /tmp/ott-baseball-emulator/firebase.json 'node --test /workspace/ott-react/tests/emulator/baseball.rules.test.mjs'
```

에뮬레이터 테스트 3개는 두 인증 컨텍스트의 실시간 상호 수신, 방송별 격리, 익명·UID 위조·초과 길이·필드 추가·시각 위조·다른 경로 쓰기·수정·삭제 거부를 확인합니다. localhost 에뮬레이터만 허용하고 운영 프로젝트에 쓰지 않습니다. Google 로그인 자체의 브라우저 E2E는 별도 검증이 필요합니다. 현재 에뮬레이터 JAR 다운로드가 네트워크 차단으로 실패해 이 테스트들은 **미실행**입니다.

## 배포와 현재 제한

GitHub `main`에 반영하면 기존 Vercel `bluepapaya/ott-react` 연동이 배포를 수행하도록 되어 있는 경로를 사용합니다. 명시적인 배포 API 호출이나 성공 확인 없이 자동 배포 완료라고 표현하지 않습니다. `vercel.json`에 서버 함수와 SPA 경로 처리가 있습니다. 배포 뒤 <https://ott-react-inky.vercel.app/sports>의 직접 접속·새로고침, `/football`, 실제 서버 API, 브라우저 영상 재생, 서로 다른 두 로그인 사용자의 송수신·격리를 각각 확인해야 합니다.

현재 직접 YouTube API 조회, WBSC 홈페이지, 배포 사이트·GitHub 배포 API, 에뮬레이터 다운로드가 네트워크 정책으로 차단되었습니다. 현재 클라우드 로컬 API는 `network_error`를 반환함을 확인했습니다. 실제 경기 목록·임베드 재생·운영 Firebase 채팅·운영 규칙·Vercel 성공은 확인되지 않았습니다. 준비된 테스트·문서는 차단이 해제된 뒤 재개하기 위한 것이며 성공 증거로 대체하지 않습니다.
