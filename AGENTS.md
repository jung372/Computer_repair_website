# AGENTS.md

이 파일은 `Computer_Repair_Website`에만 적용되며 루트 `AGENTS.md`를 보완한다.

## 범위

- vinext 기반 App Router, Cloudflare Workers, D1, Drizzle, 접수·운영자·직원 기능과 백업 도구를 다룬다.
- 개인정보, 인증, 운영 D1, Telegram과 배포 작업은 보안 영향이 큰 경계로 취급한다.

## 실행

```powershell
npm ci
npm run dev
```

- Node.js 요구 버전은 `package.json`의 `engines`를 따른다.
- 원격 마이그레이션과 배포는 사용자가 명시적으로 요청한 경우에만 `npm run db:migrate:remote`, `npm run deploy`를 실행한다.

## 구조와 계약

- `app/`, `components/`: 화면과 요청 경계.
- `lib/logic/`: 도메인 로직. UI와 저장소에서 재사용할 규칙은 이 계층에 둔다.
- `db/schema.ts`: D1 스키마의 기준 정의. `drizzle/`: 순서가 보존되어야 하는 마이그레이션 이력.
- `worker/`, `infrastructure/`: Cloudflare 런타임, 알림과 외부 연동.
- 접수번호, 권한, 상태 이력, 정산 금액과 감사 로그의 의미를 변경할 때 소비 화면과 회귀 테스트를 함께 갱신한다.

## 데이터·비밀값

- `.dev.vars`와 Worker Secrets의 값은 읽거나 출력하거나 커밋하지 않는다. 변수명은 `.dev.vars.example`에서 확인한다.
- 운영 D1과 R2 백업을 개발 검증 대상으로 직접 변경하지 않는다.
- 스키마 변경은 `db/schema.ts`에서 설계한 뒤 새 마이그레이션으로 추가한다. 적용된 기존 SQL 이력을 다시 쓰지 않는다.
- 복호화한 백업 SQL에는 개인정보가 있으므로 명시적 복구 작업 외에는 생성하지 않는다.

## 검증

```powershell
npm run lint
npm run types:check
npm test
```

- DB 변경은 새 마이그레이션 파일, 스키마 정의와 관련 테스트의 정합성을 함께 확인한다.
- UI 변경은 데스크톱·모바일과 비공개 접수 접근 통제를 함께 확인한다.

## 변경 주의사항

- `node_modules/`, `dist/`, `.wrangler/`, `tsconfig.tsbuildinfo`, `worker-configuration.d.ts`는 직접 편집하지 않는다.
- 인증 실패 제한, 마스킹, 보안 헤더와 담당자 권한을 편의상 완화하지 않는다.
- Telegram 발송, 운영 배포, 원격 D1 변경과 실제 복원은 로컬 테스트에 포함하지 않는다.
