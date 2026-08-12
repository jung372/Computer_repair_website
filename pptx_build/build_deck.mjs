import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "D:/05 AI 스터디/Computer_Repair_Website";
const BUILD = path.join(ROOT, "pptx_build");
const RENDER = path.join(BUILD, "rendered");
const FINAL = path.join(ROOT, "컴박사_웹페이지_구축_및_시행착오.pptx");
const OG_IMAGE = path.join(ROOT, "public", "og.png");

const C = {
  bg: "#F7F8FA",
  white: "#FFFFFF",
  text: "#07111F",
  muted: "#5B6575",
  light: "#E9EDF2",
  line: "#C9D0DA",
  blue: "#226BFF",
  cyan: "#17CFC3",
  green: "#0E9F6E",
  amber: "#E7A21A",
  red: "#E14B4B",
  navy: "#061327",
};

const FONT = "Malgun Gothic";
const MONO = "Consolas";

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, name, text, x, y, w, h, style = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = {
    fontSize: style.fontSize ?? 20,
    typeface: style.typeface ?? FONT,
    color: style.color ?? C.text,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "top",
    ...style,
  };
  return box;
}

function addBox(slide, name, x, y, w, h, fill = C.white, line = C.line, radius = "rounded-xl") {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1 },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function addLine(slide, name, x, y, w, h = 0, color = C.line, width = 2) {
  return slide.shapes.add({
    geometry: "straightConnector1",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function addDot(slide, name, x, y, size, fill) {
  return slide.shapes.add({
    geometry: "ellipse",
    name,
    position: { left: x, top: y, width: size, height: size },
    fill,
    line: { style: "solid", fill, width: 0 },
  });
}

function addSlideTitle(slide, number, title, kicker = "BUILD RETROSPECTIVE") {
  slide.background.fill = C.bg;
  const isCompactTitle = [4, 6, 9, 10, 11, 14].includes(number);
  const titleX = number === 11 ? 168 : 56;
  const titleW = 1280 - titleX - 56;
  addText(slide, `kicker-${number}`, kicker, titleX, 34, 520, 24, {
    fontSize: 14, bold: true, color: C.blue,
  });
  addText(slide, `title-${number}`, title, titleX, isCompactTitle ? 82 : 70, titleW, isCompactTitle ? 72 : 70, {
    fontSize: isCompactTitle ? 34 : 38, bold: true, color: C.text,
  });
  addLine(slide, `top-rule-${number}`, titleX, isCompactTitle ? 166 : 146, titleW, 0, C.line, 1);
  addText(slide, `footer-${number}`, `컴박사 웹페이지 구축 회고  ·  2026.08.09`, 56, 674, 760, 20, {
    fontSize: 12, color: C.muted,
  });
  addText(slide, `page-${number}`, String(number).padStart(2, "0"), 1160, 672, 64, 22, {
    fontSize: 12, color: C.muted, alignment: "right",
  });
}

function addNotes(slide, lines) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n${lines.map((line) => `- ${line}`).join("\n")}`);
  slide.speakerNotes.setVisible(true);
}

function addNumberedStep(slide, index, x, y, w, title, body, accent = C.blue) {
  addText(slide, `step-num-${index}-${x}`, String(index).padStart(2, "0"), x, y, 48, 36, {
    fontSize: 22, bold: true, color: accent,
  });
  addText(slide, `step-title-${index}-${x}`, title, x + 56, y, w - 56, 36, {
    fontSize: 22, bold: true,
  });
  addText(slide, `step-body-${index}-${x}`, body, x + 56, y + 40, w - 56, 72, {
    fontSize: 17, color: C.muted,
  });
}

function addMetric(slide, x, y, w, value, label, accent = C.blue) {
  addText(slide, `metric-${value}-${x}`, value, x, y, w, 78, {
    fontSize: 54, bold: true, color: accent,
  });
  addText(slide, `metric-label-${value}-${x}`, label, x, y + 82, w, 54, {
    fontSize: 18, color: C.muted,
  });
}

async function main() {
  await fs.mkdir(RENDER, { recursive: true });
  const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });

  // 1. Cover — Codex Grid slide 01 hierarchy adapted with a right-side brand image.
  {
    const slide = deck.slides.add();
    slide.background.fill = C.white;
    addText(slide, "cover-kicker", "COMBAKSA · PROJECT RETROSPECTIVE", 56, 46, 520, 28, {
      fontSize: 15, bold: true, color: C.blue,
    });
    addText(slide, "cover-title", "컴박사 웹페이지\n구축 회고", 56, 184, 540, 180, {
      fontSize: 56, bold: true, color: C.text,
    });
    addText(slide, "cover-subtitle", "구축 절차 · 시행착오 · 배포 복구 사례", 56, 404, 540, 48, {
      fontSize: 24, color: C.muted,
    });
    addText(slide, "cover-meta", "Next.js 호환 App Router · Cloudflare Workers · D1 · R2", 56, 548, 560, 42, {
      fontSize: 17, color: C.text,
    });
    const bytes = await fs.readFile(OG_IMAGE);
    slide.images.add({
      blob: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      contentType: "image/png",
      alt: "컴박사 브랜드 이미지",
      fit: "contain",
      position: { left: 672, top: 40, width: 552, height: 640 },
      geometry: "roundRect",
      borderRadius: "rounded-xl",
    });
    addNotes(slide, [
      "Repository README.md",
      "Local asset public/og.png",
      "Git commit 1d9809e60c0192db62e62342504ecb9b2bc3e612",
    ]);
  }

  // 2. Evidence-led history chart — Codex Grid slide 20 silhouette.
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 2, "11일 동안 31개 커밋으로 서비스가 운영 시스템으로 확장됐다");
    slide.charts.add("bar", {
      position: { left: 56, top: 188, width: 610, height: 430 },
      categories: ["7/29", "7/30", "7/31", "8/1", "8/9"],
      series: [{ name: "커밋 수", values: [10, 12, 3, 3, 3], fill: C.blue }],
      hasLegend: false,
      dataLabels: { showValue: true, position: "outEnd" },
      chartFill: C.bg,
      chartLine: { style: "solid", width: 0, fill: C.bg },
      plotAreaFill: { type: "none" },
      plotAreaLine: { style: "solid", width: 0, fill: C.bg },
      xAxis: { visible: true, line: { style: "solid", width: 1, fill: C.line }, textStyle: { typeface: FONT, fontSize: "14px", color: C.text } },
      yAxis: { visible: true, max: 14, majorUnit: 2, majorGridlines: { style: "solid", width: 1, fill: C.light }, line: { style: "solid", width: 0, fill: C.bg }, textStyle: { typeface: FONT, fontSize: "12px", color: C.muted } },
      barOptions: { direction: "column", grouping: "clustered", gapWidth: 90 },
    });
    const cards = [
      ["7/29", "기초 구축과 첫 배포", "웹·D1·Workers 골격을 하루에 연결"],
      ["7/30–31", "보안과 운영 안정화", "인증·입력·알림·백업을 연속 보강"],
      ["8/1–9", "직원 운영과 도메인", "권한 분리 후 브랜치 사고까지 복구"],
    ];
    cards.forEach((card, i) => {
      const y = 184 + i * 148;
      addBox(slide, `history-card-${i}`, 716, y, 508, 122, C.white, C.line);
      addText(slide, `history-date-${i}`, card[0], 742, y + 20, 110, 28, { fontSize: 17, bold: true, color: C.blue });
      addText(slide, `history-title-${i}`, card[1], 856, y + 18, 330, 32, { fontSize: 22, bold: true });
      addText(slide, `history-body-${i}`, card[2], 742, y + 60, 446, 42, { fontSize: 17, color: C.muted });
    });
    addNotes(slide, ["git log --reverse --format='%ad|%h|%s' --date=short main"]);
  }

  // 3. Process sequence.
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 3, "구축 절차는 화면 제작이 아니라 운영 흐름을 닫는 순서였다");
    addLine(slide, "process-line", 104, 312, 1060, 0, C.line, 3);
    const steps = [
      ["요구 정의", "공개/비공개 범위"],
      ["데이터 모델", "D1·마이그레이션"],
      ["UI·API", "신청·조회·관리"],
      ["보안", "세션·해시·속도 제한"],
      ["검증", "lint·build·tests"],
      ["배포·운영", "Workers·백업·복구"],
    ];
    steps.forEach((step, i) => {
      const x = 72 + i * 194;
      addDot(slide, `process-dot-${i}`, x + 36, 295, 34, i === 5 ? C.cyan : C.blue);
      addText(slide, `process-index-${i}`, String(i + 1), x + 36, 300, 34, 22, { fontSize: 14, bold: true, color: C.white, alignment: "center" });
      addText(slide, `process-title-${i}`, step[0], x, 356, 150, 34, { fontSize: 20, bold: true, alignment: "center" });
      addText(slide, `process-body-${i}`, step[1], x - 8, 400, 166, 56, { fontSize: 16, color: C.muted, alignment: "center" });
    });
    addBox(slide, "process-takeaway", 184, 516, 912, 92, C.navy, C.navy);
    addText(slide, "process-takeaway-text", "각 단계의 산출물이 다음 단계의 입력이 되도록 연결해야 재작업이 줄어든다.", 224, 542, 832, 40, {
      fontSize: 23, bold: true, color: C.white, alignment: "center",
    });
    addNotes(slide, ["README.md sections: 아키텍처, 검증, Cloudflare 배포, GitHub 자동배포"]);
  }

  // 4. Architecture diagram (connectors first, then nodes).
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 4, "구조를 네 계층으로 나눠 변경의 영향 범위를 통제했다");
    addLine(slide, "arch-arrow-1", 640, 264, 0, 42, C.blue, 3);
    addLine(slide, "arch-arrow-2", 640, 388, 0, 42, C.blue, 3);
    addLine(slide, "arch-arrow-3", 640, 512, 0, 42, C.blue, 3);
    const layers = [
      [184, "PRESENTATION", "app/ · components/", "고객 화면과 관리자 UI"],
      [308, "LOGIC", "lib/logic/ · lib/security/", "업무 규칙과 인증 정책"],
      [432, "DATA", "data/ · db/ · drizzle/", "조회·저장·스키마 진화"],
      [556, "INFRASTRUCTURE", "worker/ · infrastructure/", "Workers·Telegram·R2"],
    ];
    layers.forEach((item, i) => {
      addBox(slide, `arch-node-${i}`, 196, item[0], 888, 90, i === 3 ? C.navy : C.white, i === 3 ? C.navy : C.line);
      addText(slide, `arch-layer-${i}`, item[1], 226, item[0] + 18, 220, 28, { fontSize: 18, bold: true, color: i === 3 ? C.cyan : C.blue });
      addText(slide, `arch-path-${i}`, item[2], 456, item[0] + 18, 290, 28, { fontSize: 18, bold: true, color: i === 3 ? C.white : C.text, typeface: MONO });
      addText(slide, `arch-desc-${i}`, item[3], 760, item[0] + 18, 294, 48, { fontSize: 17, color: i === 3 ? C.white : C.muted });
    });
    addNotes(slide, ["README.md section: 아키텍처", "Repository directory structure"]);
  }

  // 5. Privacy-first request flow.
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 5, "접수 기능은 ‘공개하지 않는 조회’에서 출발했다");
    addLine(slide, "secure-flow-1", 278, 318, 116, 0, C.blue, 3);
    addLine(slide, "secure-flow-2", 570, 318, 116, 0, C.blue, 3);
    addLine(slide, "secure-flow-3", 862, 318, 116, 0, C.blue, 3);
    const nodes = [
      [72, "고객 입력", "연락처·주소·증상\n신청 비밀번호"],
      [364, "서버 검증", "정규화·속도 제한\n동일 출처 검사"],
      [656, "D1 저장", "민감정보 비공개\n해시·고정 접수번호"],
      [948, "개인 조회", "휴대전화+비밀번호\n10분 조회 세션"],
    ];
    nodes.forEach((node, i) => {
      addBox(slide, `secure-node-${i}`, node[0], 238, 238, 164, i === 2 ? C.navy : C.white, i === 2 ? C.navy : C.line);
      addText(slide, `secure-node-title-${i}`, node[1], node[0] + 22, 264, 194, 34, { fontSize: 22, bold: true, color: i === 2 ? C.cyan : C.text, alignment: "center" });
      addText(slide, `secure-node-body-${i}`, node[2], node[0] + 22, 316, 194, 62, { fontSize: 17, color: i === 2 ? C.white : C.muted, alignment: "center" });
    });
    addText(slide, "secure-principles-title", "설계 원칙", 72, 472, 160, 34, { fontSize: 22, bold: true, color: C.blue });
    addText(slide, "secure-principles", "01  공개 목록을 만들지 않는다\n02  서버에서 입력을 다시 검증한다\n03  세션과 접근 실패를 짧게 제한한다", 250, 462, 800, 118, { fontSize: 20, color: C.text });
    addNotes(slide, ["README.md 주요 기능", "lib/security/*", "data/customer-lookup-repository.ts", "drizzle/0001_private_lookup_admin.sql"]);
  }

  // 6. Before/after admin operations.
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 6, "관리 화면은 ‘운영자 1명’에서 ‘직원별 배정 운영’으로 확장됐다");
    addText(slide, "before-label", "초기 운영", 72, 188, 520, 34, { fontSize: 22, bold: true, color: C.muted });
    addText(slide, "after-label", "확장된 운영", 688, 188, 520, 34, { fontSize: 22, bold: true, color: C.blue });
    addBox(slide, "before-panel", 72, 238, 520, 336, C.white, C.line);
    addBox(slide, "after-panel", 688, 238, 520, 336, "#EAF1FF", C.blue);
    addText(slide, "before-list", "비밀번호만 입력\n담당자 이름을 자유 입력\n모든 접수를 한 화면에서 조회\n데스크톱 표 중심", 110, 276, 440, 230, { fontSize: 21, color: C.muted });
    addText(slide, "after-list", "ID + PW 통합 로그인\n운영자가 직원 계정 생성·차단\n직원은 배정된 신청만 조회\n모바일 카드·전화·SMS 지원", 726, 276, 444, 230, { fontSize: 21, color: C.text, bold: true });
    addText(slide, "after-impact", "권한이 UI가 아니라 데이터 조회·상세·저장 API 전체에 적용됨", 130, 608, 1020, 36, { fontSize: 20, bold: true, color: C.green, alignment: "center" });
    addNotes(slide, ["Commit f07c936: Implement staff access and mobile operations UI", "app/admin/staff/page.tsx", "lib/admin-auth.ts", "data/admin-request-repository.ts"]);
  }

  // 7. CI/CD pipeline.
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 7, "main 푸시 한 번으로 검증·마이그레이션·배포를 직렬화했다");
    const stages = ["main\npush", "npm ci", "lint\ntypes", "D1\nmigrate", "build\ntests", "Wrangler\ndeploy", "운영\n확인"];
    stages.forEach((stage, i) => {
      if (i < stages.length - 1) addLine(slide, `deploy-edge-${i}`, 136 + i * 166, 334, 88, 0, C.line, 3);
    });
    stages.forEach((stage, i) => {
      const x = 58 + i * 166;
      const final = i === stages.length - 1;
      addBox(slide, `deploy-node-${i}`, x, 266, 142, 136, final ? C.navy : C.white, final ? C.navy : C.line);
      addText(slide, `deploy-stage-${i}`, stage, x + 12, 304, 118, 64, { fontSize: 20, bold: true, color: final ? C.cyan : C.text, alignment: "center", verticalAlignment: "middle" });
    });
    addBox(slide, "deploy-gate", 168, 484, 944, 92, "#FFF4E1", C.amber);
    addText(slide, "deploy-gate-text", "검사나 마이그레이션이 실패하면 Worker 배포 단계에 도달하지 않는다.", 206, 511, 868, 40, { fontSize: 22, bold: true, color: C.text, alignment: "center" });
    addNotes(slide, [".github/workflows/deploy.yml", "README.md section: GitHub 자동배포"]);
  }

  // 8. Trial 1 security.
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 8, "Trial 1 — Cloudflare CPU 한계가 비밀번호 해싱 방식을 바꿨다", "TRIAL & ERROR · SECURITY");
    addNumberedStep(slide, 1, 72, 202, 500, "Argon2id 적용", "강한 해싱을 선택했지만 Worker CPU 예산에 맞지 않았다.", C.red);
    addNumberedStep(slide, 2, 72, 332, 500, "WebCrypto PBKDF2 전환", "플랫폼 기본 API로 바꿔 배포 가능성과 유지보수를 확보했다.", C.amber);
    addNumberedStep(slide, 3, 72, 462, 500, "반복 횟수 100,000 제한", "실제 Workers 한계에 맞춰 상한을 코드와 문서에 고정했다.", C.green);
    addBox(slide, "security-code", 640, 204, 568, 366, C.navy, C.navy);
    addText(slide, "security-code-text", "d616ab7  Argon2id → PBKDF2\n5a09b27  constant-time 비교 await\n324c5e9  iterations ≤ 100,000\n\ncrypto.subtle.deriveBits(...)\nPBKDF2 / SHA-256 / random salt", 678, 244, 492, 286, { fontSize: 20, color: C.white, typeface: MONO });
    addText(slide, "security-lesson", "교훈: 보안 알고리즘은 이론적 강도뿐 아니라 실행 플랫폼의 제약 안에서 검증해야 한다.", 120, 614, 1040, 38, { fontSize: 20, bold: true, color: C.blue, alignment: "center" });
    addNotes(slide, ["Commits d616ab7, 5a09b27, 324c5e9", "lib/security/password.ts", "lib/security/constant-time.ts"]);
  }

  // 9. Trial 2 input behavior — timeline layout.
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 9, "Trial 2 — 전화번호 입력은 형식화보다 실제 붙여넣기가 더 어려웠다", "TRIAL & ERROR · INPUT UX");
    addLine(slide, "phone-timeline", 100, 346, 1040, 0, C.text, 2);
    const events = [
      [120, "34b4778", "정규화", "01033881597 →\n010-3388-1597"],
      [492, "59073d4", "붙여넣기 오류", "maxLength가 원본 숫자를\n먼저 잘라내는 문제 발견"],
      [864, "a19a915", "회귀 테스트", "Playwright로 입력·붙여넣기\n행동을 자동 검증"],
    ];
    events.forEach((event, i) => {
      addDot(slide, `phone-dot-${i}`, event[0], 334, 24, i === 1 ? C.red : C.blue);
      addText(slide, `phone-hash-${i}`, event[1], event[0] - 10, 286, 140, 28, { fontSize: 16, bold: true, color: C.blue, typeface: MONO });
      addText(slide, `phone-title-${i}`, event[2], event[0] - 10, 390, 250, 34, { fontSize: 22, bold: true });
      addText(slide, `phone-body-${i}`, event[3], event[0] - 10, 436, 260, 84, { fontSize: 17, color: C.muted });
    });
    addBox(slide, "phone-lesson", 198, 566, 884, 76, "#EAF1FF", C.blue);
    addText(slide, "phone-lesson-text", "교훈: 필드 제약은 최종 값뿐 아니라 입력 순서·붙여넣기·모바일 키보드까지 테스트해야 한다.", 230, 588, 820, 34, { fontSize: 19, bold: true, alignment: "center" });
    addNotes(slide, ["Commits 34b4778, 59073d4, a19a915", "lib/phone.ts", "tests/playwright_smoke.py"]);
  }

  // 10. Reliability flows.
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 10, "Trial 3 — 알림과 백업은 ‘성공’보다 실패 후 복구가 핵심이었다", "TRIAL & ERROR · RELIABILITY");
    addText(slide, "notify-title", "Telegram 알림", 72, 190, 500, 34, { fontSize: 24, bold: true, color: C.blue });
    addText(slide, "backup-title", "D1 백업", 676, 190, 500, 34, { fontSize: 24, bold: true, color: C.cyan });
    addBox(slide, "notify-panel", 72, 240, 520, 322, C.white, C.line);
    addBox(slide, "backup-panel", 676, 240, 532, 322, C.navy, C.navy);
    addText(slide, "notify-flow", "신청 저장\n↓\n응답 경로 밖에서 발송\n↓ 실패\n대기열 기록\n↓ 5분 cron\n재시도", 112, 274, 440, 250, { fontSize: 20, bold: true, alignment: "center", color: C.text });
    addText(slide, "backup-flow", "03:00  D1 → SQL + SHA-256 manifest\n03:20  서버 PC가 R2에서 다운로드\n검증 후 Windows CMS로 암호화\nGoogle Drive 또는 로컬 보관\n보존기간 365일", 712, 278, 460, 244, { fontSize: 18, bold: true, color: C.white });
    addText(slide, "reliability-lesson", "교훈: 네트워크와 외부 서비스는 실패한다고 가정하고 재시도·무결성·복원 절차를 설계한다.", 112, 610, 1056, 34, { fontSize: 19, bold: true, color: C.green, alignment: "center" });
    addNotes(slide, ["Commit 04f769d", "Commit f74fc7a", "Commit 056c2e2", "README.md section: 서버 PC 신청 데이터 백업", "wrangler.jsonc cron triggers"]);
  }

  // 11. UX iteration.
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 11, "Trial 4 — 운영 UX는 저장·모바일에서 갈렸다", "TRIAL & ERROR · OPERATIONS UX");
    addBox(slide, "ux-left", 72, 196, 520, 390, C.white, C.line);
    addBox(slide, "ux-right", 688, 196, 520, 390, "#EAF1FF", C.blue);
    addText(slide, "ux-left-head", "저장 후 페이지 새로고침", 110, 232, 444, 36, { fontSize: 23, bold: true, color: C.red });
    addText(slide, "ux-left-body", "문제\n스크롤 위치와 검색 맥락이 사라짐\n\n개선\n비동기 저장 + 완료 메시지\nURL과 스크롤 위치 유지", 110, 292, 444, 220, { fontSize: 20, color: C.text });
    addText(slide, "ux-right-head", "모바일에서 큰 관리 표", 726, 232, 444, 36, { fontSize: 23, bold: true, color: C.blue });
    addText(slide, "ux-right-body", "문제\n열이 많아 핵심 정보와 행동이 묻힘\n\n개선\n접수 카드 + 전화 + SMS\n상세 수정으로 바로 이동", 726, 292, 444, 220, { fontSize: 20, color: C.text, bold: true });
    addText(slide, "ux-test", "Playwright가 저장 후 스크롤 유지와 390×844 모바일 카드 표시를 고정한다.", 170, 620, 940, 32, { fontSize: 18, bold: true, color: C.green, alignment: "center" });
    addNotes(slide, ["Commit f07c936", "components/admin-request-record-form.tsx", "app/admin/page.tsx", "tests/playwright_smoke.py"]);
  }

  // 12. Branch incident diagram.
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 12, "가장 큰 사고는 코드가 아니라 브랜치 흐름에서 발생했다", "TRIAL & ERROR · GIT / DEPLOYMENT");
    // Connectors first.
    addLine(slide, "main-line", 110, 316, 1030, 0, C.text, 3);
    addLine(slide, "branch-down", 260, 316, 0, 112, C.blue, 3);
    addLine(slide, "branch-line", 260, 428, 430, 0, C.blue, 3);
    addLine(slide, "merge-one", 448, 316, 0, 112, C.blue, 3);
    addLine(slide, "late-merge", 690, 316, 356, 112, C.red, 3);
    const mainNodes = [
      [112, "91f3d9c", "기준 main"],
      [432, "244825d", "PR #1 병합"],
      [752, "7eda503", "도메인 배포"],
      [1030, "1d9809e", "복구 병합"],
    ];
    mainNodes.forEach((n, i) => {
      addDot(slide, `git-main-dot-${i}`, n[0], 304, 24, i === 3 ? C.green : C.text);
      addText(slide, `git-main-hash-${i}`, n[1], n[0] - 26, 252, 120, 26, { fontSize: 16, bold: true, typeface: MONO, color: i === 3 ? C.green : C.text });
      addText(slide, `git-main-label-${i}`, n[2], n[0] - 26, 342, 160, 34, { fontSize: 17, bold: true });
    });
    addDot(slide, "git-branch-056", 436, 416, 24, C.blue);
    addText(slide, "git-branch-056-h", "056c2e2", 410, 458, 120, 26, { fontSize: 16, bold: true, typeface: MONO, color: C.blue });
    addText(slide, "git-branch-056-l", "백업 기능", 410, 490, 140, 30, { fontSize: 17, bold: true });
    addDot(slide, "git-branch-f07", 678, 416, 24, C.red);
    addText(slide, "git-branch-f07-h", "f07c936", 652, 458, 120, 26, { fontSize: 16, bold: true, typeface: MONO, color: C.red });
    addText(slide, "git-branch-f07-l", "ID/PW·직원 관리\nPR 종료 후 추가됨", 652, 490, 220, 56, { fontSize: 17, bold: true, color: C.red });
    addBox(slide, "git-root-cause", 156, 578, 968, 74, "#FFF0F0", C.red);
    addText(slide, "git-root-cause-text", "원인: PR이 이미 병합된 뒤 같은 브랜치에 새 커밋을 추가했고, main에는 포함되지 않은 채 도메인 배포가 진행됐다.", 190, 598, 900, 38, { fontSize: 18, bold: true, alignment: "center" });
    addNotes(slide, ["GitHub PR #1 https://github.com/jung372/Computer_repair_website/pull/1", "GitHub PR #2 https://github.com/jung372/Computer_repair_website/pull/2", "Commits 056c2e2, f07c936, 7eda503, 1d9809e"]);
  }

  // 13. Recovery metrics.
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 13, "복구는 병합·검증·배포를 한 번에 닫는 방식으로 진행했다");
    addMetric(slide, 72, 210, 240, "1", "package.json 충돌\n두 테스트 목록 모두 유지", C.red);
    addMetric(slide, 374, 210, 240, "31", "회귀 테스트 통과\nfail 0", C.blue);
    addMetric(slide, 676, 210, 240, "0 / 0", "main ↔ origin/main\nahead / behind", C.green);
    addMetric(slide, 978, 210, 240, "#28", "GitHub Actions\n배포 성공", C.cyan);
    addLine(slide, "recovery-divider", 72, 390, 1136, 0, C.line, 1);
    addText(slide, "recovery-sequence-title", "복구 순서", 72, 424, 180, 34, { fontSize: 22, bold: true, color: C.blue });
    addText(slide, "recovery-sequence", "브랜치 비교  →  main 병합  →  충돌 해결  →  lint·types·build·tests  →  push  →  운영 화면 확인", 72, 480, 1136, 50, { fontSize: 20, bold: true, alignment: "center" });
    addBox(slide, "recovery-proof", 212, 566, 856, 76, C.navy, C.navy);
    addText(slide, "recovery-proof-text", "운영 페이지에서 ‘아이디’와 ‘비밀번호’ 입력란을 직접 확인하며 종료", 250, 588, 780, 34, { fontSize: 20, bold: true, color: C.white, alignment: "center" });
    addNotes(slide, ["Commit 1d9809e", "Local validation: npm run lint, wrangler types --check, npm test", "GitHub Actions Run #28 https://github.com/jung372/Computer_repair_website/actions/runs/31298327142", "Production URL https://combaksa.pe.kr/admin/login"]);
  }

  // 14. Controls checklist — Codex Grid slide 10 hierarchy.
  {
    const slide = deck.slides.add();
    addSlideTitle(slide, 14, "다음 프로젝트에서는 다섯 가지 통제를 기본값으로 둔다");
    addText(slide, "controls-lead", "코드 품질과 배포 품질을 같은 프로세스에서 관리한다.", 72, 188, 520, 72, { fontSize: 24, bold: true });
    addText(slide, "controls-body", "브랜치 사고는 테스트가 잡지 못한다.\n반대로 배포 통제만으로는 입력 UX나 복원 가능성을 보장하지 못한다.\n두 영역을 함께 운영해야 한다.", 72, 292, 520, 200, { fontSize: 19, color: C.muted });
    const controls = [
      "PR 병합 후 브랜치 재사용 금지",
      "main 기준 재베이스 후 새 PR 생성",
      "CI에 lint·types·migration·tests 고정",
      "배포 뒤 핵심 화면 smoke test",
      "백업 복원 절차와 운영 runbook 유지",
    ];
    controls.forEach((control, i) => {
      addDot(slide, `control-check-${i}`, 688, 198 + i * 78, 28, C.blue);
      addText(slide, `control-checkmark-${i}`, "✓", 688, 198 + i * 78, 28, 24, { fontSize: 16, bold: true, color: C.white, alignment: "center" });
      addText(slide, `control-text-${i}`, control, 734, 192 + i * 78, 470, 44, { fontSize: 20, bold: true });
    });
    addNotes(slide, ["Lessons synthesized from repository Git history, deploy.yml, tests, backup scripts, and the f07c936 merge incident"]);
  }

  // 15. Close — Codex Grid slide 26 hierarchy.
  {
    const slide = deck.slides.add();
    slide.background.fill = C.navy;
    addText(slide, "close-kicker", "FINAL TAKEAWAY", 56, 48, 320, 28, { fontSize: 15, bold: true, color: C.cyan });
    addText(slide, "close-title", "완성된 화면보다 중요한 것은\n복구 가능한 운영 과정이다", 56, 188, 1080, 190, { fontSize: 52, bold: true, color: C.white });
    addText(slide, "close-body", "기능 · 데이터 · 보안 · 배포 · 백업이 한 흐름으로 연결될 때\n웹페이지는 비로소 운영 가능한 서비스가 된다.", 56, 448, 900, 90, { fontSize: 24, color: "#C7D5EA" });
    addLine(slide, "close-rule", 56, 590, 1168, 0, "#31445E", 1);
    addText(slide, "close-url", "https://combaksa.pe.kr", 56, 620, 520, 30, { fontSize: 18, bold: true, color: C.cyan });
    addText(slide, "close-date", "COMBAKSA · 2026.08.09", 912, 620, 312, 30, { fontSize: 16, color: "#8FA3BF", alignment: "right" });
    addNotes(slide, ["README.md", "Git history through commit 1d9809e", "Production URL https://combaksa.pe.kr"]);
  }

  // Render, inspect-friendly layout exports, montage, and final PPTX.
  for (const [index, slide] of deck.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(RENDER, `${stem}.png`), await deck.export({ slide, format: "png", scale: 1 }));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(RENDER, `${stem}.layout.json`), await layout.text());
  }
  await writeBlob(path.join(BUILD, "montage.webp"), await deck.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(FINAL);
  console.log(JSON.stringify({ final: FINAL, slides: deck.slides.items.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
