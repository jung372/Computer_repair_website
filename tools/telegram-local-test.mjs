// 로컬 개발 서버에 테스트 접수를 1건 넣고, 텔레그램 발송 결과를 확인합니다.
// 사용법: node build/telegram-local-test.mjs [origin]
const origin = process.argv[2] ?? "http://localhost:3000";

const payload = {
  name: "테스트 고객",
  phone: "01012345678",
  address1: "서울시 강남구 테헤란로 1",
  address2: "101호",
  manufacturerModel: "테스트 데스크탑",
  deviceType: "desktop",
  symptom: "전원이 켜지지 않음",
  description: "텔레그램 알림 연동을 확인하기 위한 테스트 접수입니다.",
  password: "test1234",
  privacyConsent: true,
};

const res = await fetch(`${origin}/api/requests`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin, // 서버가 같은 출처인지 검사합니다.
  },
  body: JSON.stringify(payload),
});

const body = await res.json().catch(() => ({}));
console.log("HTTP", res.status, JSON.stringify(body));

if (res.status === 201) {
  console.log(`\n접수번호 ${body.publicId} 생성. 텔레그램 대화방을 확인하세요.`);
  console.log("발송 결과는 아래 명령으로 확인할 수 있습니다:");
  console.log(
    '  npx wrangler d1 execute baroon-computer-repair-db --local --command "SELECT status, attempts, last_error FROM notification_outbox ORDER BY created_at DESC LIMIT 3"',
  );
} else {
  console.log("\n접수가 실패했습니다. 위 메시지를 확인하세요.");
}
