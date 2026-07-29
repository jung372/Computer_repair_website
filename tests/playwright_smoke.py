from pathlib import Path
import re

from playwright.sync_api import sync_playwright


BASE_URL = "http://localhost:3000"
ARTIFACTS = Path("tests/artifacts")
ARTIFACTS.mkdir(parents=True, exist_ok=True)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    browser_errors: list[str] = []
    page.on("pageerror", lambda error: browser_errors.append(str(error)))
    page.on(
        "console",
        lambda message: browser_errors.append(message.text)
        if message.type == "error"
        else None,
    )

    page.goto(BASE_URL, wait_until="networkidle")
    assert page.get_by_role("link", name="내 신청 조회").first.is_visible()
    assert page.get_by_text("최근 신청 현황").count() == 0
    assert "010-3388-1597" in page.locator("body").inner_text()
    page.screenshot(path=str(ARTIFACTS / "home-desktop.png"), full_page=True)

    page.goto(f"{BASE_URL}/requests", wait_until="networkidle")
    assert page.get_by_role("heading", name="내 신청 조회", exact=True).is_visible()
    assert page.get_by_label("휴대전화 번호").is_visible()
    assert page.get_by_label("신청 비밀번호").is_visible()
    assert page.get_by_text("전체 상태").count() == 0
    page.screenshot(path=str(ARTIFACTS / "lookup-desktop.png"), full_page=True)

    page.goto(f"{BASE_URL}/requests/new", wait_until="networkidle")
    assert page.locator('input[name="postalCode"]').count() == 0
    assert page.locator('input[value="PUBLIC"]').count() == 0
    assert page.get_by_label("신청 조회 비밀번호 *").get_attribute("minlength") == "4"
    assert page.get_by_label("신청 조회 비밀번호 *").get_attribute("maxlength") == "20"

    page.get_by_label("연락처 *").fill("010-1234-5678")
    page.get_by_label("기본 주소 *").fill("서울시 강남구 테헤란로")
    page.get_by_label("기기 종류 *").select_option("desktop")
    page.get_by_label("대표 증상 *").fill("전원이 켜지지 않아요")
    page.get_by_label("상세 접수 내용 *").fill(
        "어제부터 전원 버튼을 눌러도 컴퓨터가 켜지지 않습니다."
    )
    page.get_by_label("신청 조회 비밀번호 *").fill("test1234")
    page.get_by_label(re.compile("개인정보 수집")).check()
    page.get_by_role("button", name="서비스 신청하기").click()
    page.wait_for_url(re.compile(r"/requests/R-\d{8}-[A-F0-9]{6}\?submitted=1"))
    page.wait_for_load_state("networkidle")
    assert page.get_by_text("서비스 신청이 완료되었습니다.").is_visible()
    assert page.get_by_text("전원이 켜지지 않아요", exact=True).is_visible()

    page.goto(f"{BASE_URL}/requests", wait_until="networkidle")
    assert page.get_by_text(re.compile(r"확인된 신청 \d+건")).is_visible()
    assert page.get_by_text("전원이 켜지지 않아요", exact=True).is_visible()
    page.get_by_role("button", name="조회 종료").click()
    page.wait_for_load_state("networkidle")
    assert re.search(r"/requests/?$", page.url), (
        f"unexpected logout URL: {page.url}; body={page.locator('body').inner_text()}"
    )
    assert page.get_by_label("휴대전화 번호").is_visible()

    page.get_by_label("휴대전화 번호").fill("010-1234-5678")
    page.get_by_label("신청 비밀번호").fill("test1234")
    page.get_by_role("button", name="내 신청 조회", exact=True).click()
    page.wait_for_url(re.compile(r"/requests\?unlocked=1"))
    page.wait_for_load_state("networkidle")
    assert page.get_by_text(re.compile(r"확인된 신청 \d+건")).is_visible()

    page.goto(f"{BASE_URL}/admin/setup", wait_until="networkidle")
    if page.get_by_role("heading", name="운영자 비밀번호 설정").count():
        page.get_by_label("최초 설정 토큰").fill("setup-token-for-local-e2e")
        page.get_by_label("새 운영자 비밀번호", exact=True).fill("StrongLocalAdmin123!")
        page.get_by_label("새 비밀번호 확인", exact=True).fill("StrongLocalAdmin123!")
        page.get_by_role("button", name="운영자 비밀번호 저장").click()
        page.wait_for_url(re.compile(r"/admin/login\?setup=done"))
        page.wait_for_load_state("networkidle")

    page.goto(f"{BASE_URL}/admin/login", wait_until="networkidle")
    page.get_by_label("운영자 비밀번호").fill("StrongLocalAdmin123!")
    page.get_by_role("button", name="로그인").click()
    page.wait_for_url(f"{BASE_URL}/admin")
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="서비스 접수 관리").is_visible()
    assert page.get_by_role("heading", name="접수내역 검색").is_visible()
    assert page.get_by_role("columnheader", name="번호").is_visible()
    assert page.get_by_role("columnheader", name="담당자").is_visible()
    assert page.get_by_role("link", name="미상").first.is_visible()
    assert (
        page.get_by_role("table").locator("tbody tr").first.locator("td").first.inner_text()
        == "1"
    )
    page.screenshot(path=str(ARTIFACTS / "admin-ledger-desktop.png"), full_page=True)

    page.get_by_role("link", name="미상").first.click()
    page.wait_for_url(re.compile(r"/admin/requests/R-\d{8}-[A-F0-9]{6}"))
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="미상 고객 접수").is_visible(), (
        f"unexpected detail page: {page.url}; body={page.locator('body').inner_text()}"
    )
    page.get_by_label("접수구분 *").select_option(label="관리자접수")
    page.get_by_label("담당자", exact=True).fill("테스트 담당자")
    page.get_by_label("방문구분").select_option(label="즉시")
    page.get_by_label("고객분류 *").select_option(label="재방문고객")
    with page.expect_navigation(wait_until="networkidle"):
        page.get_by_role("button", name="저장", exact=True).click()
    assert page.get_by_label("담당자", exact=True).input_value() == "테스트 담당자"
    assert page.get_by_label("방문구분").input_value() == "즉시"
    page.get_by_role("link", name="목록").click()
    page.wait_for_url(f"{BASE_URL}/admin")
    page.wait_for_load_state("networkidle")
    admin_table = page.get_by_role("table")
    assert admin_table.get_by_text("테스트 담당자", exact=True).first.is_visible()
    assert admin_table.get_by_text("재방문고객", exact=True).first.is_visible()

    page.get_by_role("link", name="비밀번호 변경").click()
    page.wait_for_load_state("networkidle")
    page.get_by_label("현재 비밀번호").fill("StrongLocalAdmin123!")
    page.get_by_label("새 비밀번호", exact=True).fill("ChangedLocalAdmin456!")
    page.get_by_label("새 비밀번호 확인", exact=True).fill("ChangedLocalAdmin456!")
    page.get_by_role("button", name="비밀번호 변경").click()
    page.wait_for_url(re.compile(r"/admin/login\?changed=done"))
    page.wait_for_load_state("networkidle")
    page.get_by_label("운영자 비밀번호").fill("ChangedLocalAdmin456!")
    page.get_by_role("button", name="로그인").click()
    page.wait_for_url(f"{BASE_URL}/admin")
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="서비스 접수 관리").is_visible()

    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto(f"{BASE_URL}/requests", wait_until="networkidle")
    assert mobile.get_by_role("heading", name="내 신청 조회", exact=True).is_visible()
    mobile.screenshot(path=str(ARTIFACTS / "lookup-mobile.png"), full_page=True)
    mobile.close()

    assert not browser_errors, f"browser errors: {browser_errors}"
    browser.close()
