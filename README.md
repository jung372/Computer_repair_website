# 컴박사

개인 컴퓨터 수리 사업자를 위한 서비스 접수·관리 웹사이트입니다.
Next.js 호환 App Router를 vinext로 빌드하고 Cloudflare Workers와 D1에서 실행합니다.

## 주요 기능

- 컴퓨터·노트북·모니터·애플기기 고장 증상과 데이터 복구 안내
- 연락처·기본 주소·접수 내용 기반 비공개 서비스 신청(이름·상세 주소 선택)
- 휴대전화 번호와 신청 비밀번호 기반 내 신청 조회
- 비공개 신청 인증, 10분 조회 세션과 접근 횟수 제한
- 운영자 최초 비밀번호 설정·변경
- 고정 접수번호, 복합 검색, 담당자·일정·계산서·정산·처리상태 관리대장
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

로컬 비밀값은 Git에 포함되지 않는 `.dev.vars`에 설정합니다.
`.dev.vars.example`을 복사하고 각 값을 새 무작위 값으로 바꿔 사용하세요.

```dotenv
ADMIN_SESSION_SECRET=change-me
ADMIN_SETUP_TOKEN=change-me
REQUEST_ACCESS_SECRET=change-me
REQUEST_LOOKUP_SECRET=change-me
RATE_LIMIT_SECRET=change-me
TELEGRAM_NOTIFICATION_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

운영 환경에서는 다음 값들을 `wrangler secret put <이름>`으로 등록합니다.

- `ADMIN_SESSION_SECRET`
- `ADMIN_SETUP_TOKEN` — 최초 운영자 설정 후 삭제
- `REQUEST_ACCESS_SECRET`
- `REQUEST_LOOKUP_SECRET`
- `RATE_LIMIT_SECRET`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Telegram을 사용할 때만

최초 배포 후 `/admin/setup`에서 운영자 비밀번호를 설정하고, 로그인 후
`/admin/settings/security`에서 변경할 수 있습니다.

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
