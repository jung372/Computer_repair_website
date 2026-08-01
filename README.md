# 컴박사

개인 컴퓨터 수리 사업자를 위한 서비스 접수·관리 웹사이트입니다.
Next.js 호환 App Router를 vinext로 빌드하고 Cloudflare Workers와 D1에서 실행합니다.

## 주요 기능

- 컴퓨터·노트북·모니터·애플기기 고장 증상과 데이터 복구 안내
- 연락처·기본 주소·접수 내용 기반 비공개 서비스 신청(이름·상세 주소 선택)
- 휴대전화 번호와 신청 비밀번호 기반 내 신청 조회
- 비공개 신청 인증, 10분 조회 세션과 접근 횟수 제한
- 운영자 최초 비밀번호 설정·변경
- 운영자·직원 통합 로그인, 연락처 자동 포맷, 직원 계정 관리와 담당 신청별 접근 제어
- 고정 접수번호, 복합 검색, 담당자 배정·일정·계산서·정산·처리상태 관리대장
- 텔레그램 신규 접수 알림과 실패 재처리
- 개인정보 마스킹, 보안 헤더, 모바일 접수 카드와 컴박사 공유 미리보기

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

## 서버 PC 신청 데이터 백업

운영 D1은 매일 03:00 KST에 복구 가능한 SQL로 직렬화되어
`combaksa-computer-repair-backups` R2 버킷에 저장됩니다. SQL과 함께 파일 크기,
SHA-256, 테이블별 행 수를 기록한 manifest가 생성됩니다.

서버 PC는 03:20 KST와 사용자 로그인 시 R2의 최신 백업을 내려받아 무결성을
검사하고 Windows CMS 인증서로 암호화합니다. Google Drive Desktop의 동기화
폴더를 찾으면 암호화된 파일을 그곳에 저장하고, 찾지 못하면
`D:\SecureBackups\ComputerRepair`를 사용합니다. 두 저장소 모두 보존기간은
365일입니다. SQL 원문과 Cloudflare API Token은 Google Drive에 기록되지 않습니다.

서버 PC의 관리자 PowerShell에서 저장소를 clone하고 `npm ci`를 실행한 다음
설정합니다. Google Drive 경로는 자동 탐색보다 명시하는 편이 안전합니다.

```powershell
Set-Location "D:\05 AI Study\Computer_Repair_Website"
npm ci
.\tools\server-backup\setup-backup-task.ps1 `
  -GoogleDriveRoot "G:\내 드라이브" `
  -CertificateBackupPath "E:\OfflineKeys\computer-repair-backup.pfx"
```

설정 과정에서 다음 값을 입력합니다.

- 해당 R2 버킷만 읽을 수 있는 Cloudflare API Token
- 오프라인 PFX 복구본을 보호할 비밀번호

Google Drive가 설치되지 않았거나 지정 경로가 쓰기 불가능하면 로컬 폴더로
자동 대체됩니다. 암호화 개인키가 서버와 함께 손실되면 Google Drive 백업을
복구할 수 없으므로 PFX와 비밀번호는 Google Drive 밖의 별도 보호 매체에
보관해야 합니다.

암호화된 백업을 SQL로 복호화할 때는 다음 명령을 사용합니다. 이 명령은 SQL
파일만 만들며 운영 D1을 자동으로 변경하지 않습니다.

```powershell
.\tools\server-backup\restore-backup.ps1 `
  -EncryptedBackupPath "G:\내 드라이브\ComputerRepairBackups\2026\08\d1-2026-08-01.sql.p7m" `
  -OutputSqlPath "D:\RestoreStaging\d1-2026-08-01.sql"
```

복구 SQL은 먼저 임시 D1에 마이그레이션과 함께 적용해 테이블별 건수를 검증한
후 운영 복구에 사용합니다. 개인정보가 포함된 복호화 SQL은 점검 종료 즉시
안전하게 제거합니다.
