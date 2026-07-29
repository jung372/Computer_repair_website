# 컴박사

개인 컴퓨터 수리 사업자를 위한 서비스 접수·관리 웹사이트입니다.
Next.js 호환 App Router를 vinext로 빌드하고 Cloudflare Workers와 D1에서 실행합니다.

## 주요 기능

- 컴퓨터·노트북·모니터·애플기기 고장 증상 안내
- 이름·연락처·주소·접수 내용 기반 서비스 신청
- 공개·비공개 접수 게시판
- 비공개 게시글 비밀번호 인증과 접근 횟수 제한
- 운영자 비밀번호 로그인 및 접수 상태 관리
- 텔레그램 신규 접수 알림과 실패 재처리
- 개인정보 마스킹, 보안 헤더, 모바일 반응형 UI

## 아키텍처

- Presentation: `app/`, `components/`
- Logic: `lib/logic/`
- Data: `data/`, `db/`, `drizzle/`
- Infrastructure: `worker/`, `infrastructure/`

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm ci
npm run dev
```

로컬 비밀값은 Git에 포함되지 않는 `.dev.vars` 또는 `.env.local`에 설정합니다.

```dotenv
ADMIN_PASSWORD=change-me
ADMIN_SESSION_SECRET=change-me
REQUEST_ACCESS_SECRET=change-me
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

## 검증

```bash
npm run lint
npm run types:check
npm test
```

## Cloudflare 배포

`wrangler.jsonc`에 Worker와 D1 바인딩이 선언되어 있습니다.

```bash
npm run db:migrate:remote
npm run deploy
```

운영 비밀값은 저장소나 Wrangler 설정에 기록하지 않고 Cloudflare Worker Secret으로 관리합니다.

## GitHub 자동배포

`main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 다음 작업을 수행합니다.

1. 의존성 설치와 소스 검사
2. Worker 바인딩 타입 검증
3. D1 마이그레이션
4. 프로덕션 빌드와 회귀 테스트
5. Cloudflare Workers 배포

저장소에는 `CLOUDFLARE_API_TOKEN` GitHub Actions Secret이 필요합니다. Account ID는 `wrangler.jsonc`에서 관리합니다.
