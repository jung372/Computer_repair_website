from pathlib import Path
import base64
import re
import tempfile

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3000"
ARTIFACTS = Path(tempfile.gettempdir()) / "combaksa-marketing-ui"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
PASSWORD = "MarketingLocalAdmin123!"
SETUP_TOKEN = "marketing-ui-setup-token"
PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1100})
    browser_errors: list[str] = []
    page.on("pageerror", lambda error: browser_errors.append(str(error)))
    page.on(
        "console",
        lambda message: browser_errors.append(message.text)
        if message.type == "error"
        else None,
    )

    page.goto(f"{BASE_URL}/admin/setup", wait_until="networkidle")
    if page.get_by_role("heading", name="운영자 비밀번호 설정").count():
        page.locator('input[name="setupToken"]').fill(SETUP_TOKEN)
        page.locator('input[name="newPassword"]').fill(PASSWORD)
        page.locator('input[name="confirmPassword"]').fill(PASSWORD)
        page.get_by_role("button", name="운영자 비밀번호 저장").click()
        page.wait_for_url(re.compile(r"/admin/login\?setup=done"))
        page.wait_for_load_state("networkidle")

    page.goto(f"{BASE_URL}/admin/login", wait_until="networkidle")
    page.locator('input[name="loginName"]').fill("admin")
    page.locator('input[name="password"]').fill(PASSWORD)
    page.get_by_role("button", name="로그인").click()
    page.wait_for_url(f"{BASE_URL}/admin")
    page.wait_for_load_state("networkidle")

    page.goto(f"{BASE_URL}/admin/marketing", wait_until="networkidle")
    assert page.get_by_role("heading", name="수리일지 생성").is_visible()
    assert "로컬 AI" in page.locator(".workbench-strip").inner_text()
    assert page.locator('input[name="privacyReviewed"]').count() == 1
    assert page.get_by_role("tab", name="수리일지 등록").get_attribute("aria-selected") == "true"
    assert page.get_by_text("휴대폰 사진 용량").is_visible()

    file_input = page.locator("#marketing-photos")
    large_photo_base64 = page.evaluate("""async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 3200;
      canvas.height = 2400;
      const context = canvas.getContext('2d');
      const gradient = context.createLinearGradient(0, 0, 3200, 2400);
      gradient.addColorStop(0, '#17232e');
      gradient.addColorStop(1, '#efb23c');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 3200, 2400);
      context.fillStyle = '#ffffff';
      context.font = '180px sans-serif';
      context.fillText('COMBAKSA REPAIR', 220, 1200);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.96));
      return await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
    }""")
    file_input.set_input_files({"name": "mobile-large.jpg", "mimeType": "image/jpeg", "buffer": base64.b64decode(large_photo_base64)})
    optimized_card = page.locator(".marketing-photo-grid article").first
    assert optimized_card.get_attribute("data-original-size") == "3200x2400"
    assert optimized_card.get_attribute("data-upload-size") == "2048x1536"
    assert int(optimized_card.get_attribute("data-upload-bytes")) <= 2 * 1024 * 1024
    assert page.get_by_text(re.compile(r"원본 .* → 업로드")).first.is_visible()
    page.get_by_role("button", name="mobile-large.jpg 삭제").click()

    file_input.set_input_files({"name": "repair.png", "mimeType": "image/png", "buffer": PNG_1X1})
    assert page.get_by_alt_text("선택한 수리 사진 1").is_visible()
    page.get_by_role("button", name="repair.png 삭제").click()
    assert page.get_by_alt_text("선택한 수리 사진 1").count() == 0

    page.locator('textarea[name="symptom"]').fill("전원은 켜지지만 화면이 나오지 않음")
    file_input.set_input_files({"name": "repair.png", "mimeType": "image/png", "buffer": PNG_1X1})
    page.get_by_role("button", name="전체 초기화").click()
    assert page.locator('textarea[name="symptom"]').input_value() == ""
    assert page.get_by_alt_text("선택한 수리 사진 1").count() == 0

    page.locator('textarea[name="symptom"]').fill("전원은 켜지지만 화면이 나오지 않음")
    page.locator('textarea[name="diagnosedCause"]').fill("메모리 접촉 불량")
    page.locator('textarea[name="actionsTaken"]').fill("메모리 분리 후 접점 정리 및 재장착")
    page.locator('textarea[name="verificationResult"]').fill("3회 재부팅과 Windows 진입 정상 확인")
    page.locator('input[name="deviceInfo"]').fill("조립 PC, DDR4 메모리")
    page.locator('input[name="workDuration"]').fill("약 40분")
    file_input.set_input_files({"name": "repair.png", "mimeType": "image/png", "buffer": PNG_1X1})
    page.locator('input[name="photoConsent"]').check()
    page.locator('input[name="privacyReviewed"]').check()
    page.locator('input[name="photoEvidenceNote"]').fill("제품 라벨과 개인정보 노출 없음 확인")
    page.screenshot(path=str(ARTIFACTS / "marketing-upload-v2-desktop.png"), full_page=True)
    with page.expect_response(lambda response: response.url.endswith("/api/admin/marketing/jobs")) as submission:
        page.get_by_role("button", name="AI 수리일지 생성 요청").click()
    assert submission.value.status == 201, submission.value.text()
    page.goto(f"{BASE_URL}/admin/marketing?view=history", wait_until="networkidle")
    assert page.get_by_text("클라우드 대기", exact=True).first.is_visible()
    page.screenshot(path=str(ARTIFACTS / "marketing-history-v2-desktop.png"), full_page=True)

    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(f"{BASE_URL}/admin/marketing", wait_until="networkidle")
    assert page.get_by_role("heading", name="수리일지 생성").is_visible()
    assert page.locator(".workbench-strip").is_visible()
    overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    assert not overflow, "mobile marketing intake has horizontal overflow"
    page.screenshot(path=str(ARTIFACTS / "marketing-upload-v2-mobile.png"), full_page=True)

    assert not browser_errors, f"browser errors: {browser_errors}"
    browser.close()

print("marketing UI smoke test passed")
