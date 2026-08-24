from pathlib import Path
import re

from playwright.sync_api import sync_playwright


BASE_URL = "http://localhost:3000"
ARTIFACTS = Path("tests/artifacts")
ARTIFACTS.mkdir(parents=True, exist_ok=True)


def dev_var(name: str, fallback: str) -> str:
    """Reads a value from .dev.vars so the test uses the same secret as the runtime."""
    env_file = Path(".dev.vars")
    if not env_file.exists():
        return fallback
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{name}="):
            return line[len(name) + 1 :].strip() or fallback
    return fallback


# The setup route verifies this token, so it has to match the running worker.
SETUP_TOKEN = dev_var("ADMIN_SETUP_TOKEN", "setup-token-for-local-e2e")


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
    # 전자상거래법상 표시 의무 사항이므로 모든 페이지 하단에 노출되어야 한다.
    footer_text = page.locator(".footer-business").inner_text()
    assert "사업자등록번호 389-80-03376" in footer_text, footer_text
    assert "대표 김규웅" in footer_text, footer_text
    assert "서울특별시 광진구 자양로19길 42-17, 101호" in footer_text, footer_text
    page.screenshot(path=str(ARTIFACTS / "home-desktop.png"), full_page=True)

    page.goto(f"{BASE_URL}/requests", wait_until="networkidle")
    assert page.get_by_role("heading", name="내 신청 조회", exact=True).is_visible()
    assert page.get_by_label("휴대전화 번호").is_visible()
    assert page.get_by_label("신청 조회 비밀번호").is_visible()
    assert page.get_by_text("전체 상태").count() == 0
    page.screenshot(path=str(ARTIFACTS / "lookup-desktop.png"), full_page=True)

    page.goto(f"{BASE_URL}/requests/new", wait_until="networkidle")
    assert page.locator('input[name="postalCode"]').count() == 0
    assert page.locator('input[value="PUBLIC"]').count() == 0
    assert page.get_by_label("조회 비밀번호").get_attribute("minlength") == "4"
    assert page.get_by_label("조회 비밀번호").get_attribute("maxlength") == "20"

    # 모바일은 홍보 패널과 중복 하단 메뉴 없이 첫 화면에서 바로 입력한다.
    page.set_viewport_size({"width": 390, "height": 844})
    assert not page.locator(".form-page-side").is_visible()
    assert page.get_by_text("약 2분이면 신청 완료", exact=True).is_visible()
    assert not page.locator(".mobile-actions").is_visible()
    phone_box = page.get_by_label("연락처 *").bounding_box()
    assert phone_box and phone_box["y"] < 220, phone_box
    assert page.get_by_label("이름").is_visible()
    assert page.get_by_label("이름").bounding_box()["y"] < phone_box["y"]
    assert page.get_by_label("조회 비밀번호").is_visible()
    assert not page.get_by_label("기기 종류").is_visible()
    page.get_by_role("button", name=re.compile("추가 정보 입력")).click()
    assert page.get_by_label("기기 종류").is_visible()
    page.screenshot(path=str(ARTIFACTS / "request-mobile.png"), full_page=False)
    page.set_viewport_size({"width": 1440, "height": 1000})

    # 연락처는 무엇을 입력하든 정규 형식으로 수렴해야 한다.
    phone_field = page.get_by_label("연락처 *")
    # maxlength가 있으면 브라우저가 정규화 전에 원본을 잘라 국제번호 붙여넣기가 깨진다.
    assert phone_field.get_attribute("maxlength") is None, (
        "연락처 입력란에 maxlength가 생기면 긴 형식이 정규화 전에 잘린다"
    )

    for typed, expected in [
        ("01012345678", "010-1234-5678"),
        ("010-1234-5678", "010-1234-5678"),
        ("010 1234.5678", "010-1234-5678"),
        ("0101234", "010-1234"),
    ]:
        phone_field.fill("")
        phone_field.click()
        phone_field.press_sequentially(typed)
        assert phone_field.input_value() == expected, (
            f"타이핑 {typed!r} -> {phone_field.input_value()!r}, 기대 {expected!r}"
        )

    for pasted, expected in [
        ("  +82 10-9999-0000  ", "010-9999-0000"),
        ("0082 10 9999 0000", "010-9999-0000"),
        ("(010) 1234-5678", "010-1234-5678"),
        ("０１０１２３４５６７８", "010-1234-5678"),
        ("0111234567", "011-123-4567"),
        ("0212345678", "02-1234-5678"),
    ]:
        phone_field.fill("")
        phone_field.fill(pasted)
        page.get_by_label("기본주소 *").click()
        assert phone_field.input_value() == expected, (
            f"붙여넣기 {pasted!r} -> {phone_field.input_value()!r}, 기대 {expected!r}"
        )

    # 숫자만 입력해도 저장은 하이픈 형식이어야 하므로 숫자로 타이핑한다.
    phone_field.fill("")
    phone_field.click()
    phone_field.press_sequentially("01012345678")
    assert phone_field.input_value() == "010-1234-5678"
    page.get_by_label("기본주소 *").fill("서울시 강남구 테헤란로")
    page.get_by_label("대표 증상 *").fill("전원이 켜지지 않아요")
    # 희망 방문 일시는 더 이상 수집하지 않는다.
    assert page.get_by_label("희망 방문 일시").count() == 0
    # 상세 접수 내용은 길이 제한이 없어야 하므로 옛 상한(2,000자)을 넘겨 확인한다.
    long_description = "어제부터 전원 버튼을 눌러도 컴퓨터가 켜지지 않습니다. " * 120
    description_field = page.get_by_label("상세 접수 내용")
    description_field.fill(long_description)
    assert len(description_field.input_value()) == len(long_description), (
        f"상세 접수 내용이 잘렸습니다: {len(description_field.input_value())}"
        f" / {len(long_description)}"
    )
    page.get_by_label("조회 비밀번호").fill("test1234")
    page.get_by_role("button", name="서비스 신청하기").click()
    page.wait_for_url(re.compile(r"/requests/R-\d{8}-[A-F0-9]{6}\?submitted=1"))
    page.wait_for_load_state("networkidle")
    assert page.get_by_text("서비스 신청이 완료되었습니다.").is_visible()
    assert page.get_by_text("전원이 켜지지 않아요", exact=True).is_visible()
    assert page.get_by_text("미입력", exact=True).is_visible()
    assert page.get_by_text("희망 일정").count() == 0
    detail_description = page.locator(".request-description p").inner_text()
    assert len(detail_description) == len(long_description.strip()), (
        f"저장된 접수 내용이 잘렸습니다: {len(detail_description)}"
        f" / {len(long_description.strip())}"
    )
    # 숫자만 입력했지만 정규 형식으로 저장되었으므로 마스킹도 하이픈 형식이어야 한다.
    assert "010-****-5678" in page.locator("body").inner_text(), (
        f"연락처 마스킹이 정규 형식이 아님: {page.locator('body').inner_text()}"
    )

    # 폼을 거치지 않는 원본 형식으로도 서버가 같은 접수를 찾아야 한다.
    raw_lookup = page.request.post(
        f"{BASE_URL}/api/requests/lookup",
        data={"phone": "+82 10 1234 5678", "password": "test1234"},
        headers={"origin": BASE_URL, "referer": f"{BASE_URL}/requests"},
    )
    assert raw_lookup.ok, (
        f"국제번호 형식 조회 실패: {raw_lookup.status} {raw_lookup.text()}"
    )

    page.goto(f"{BASE_URL}/requests", wait_until="networkidle")
    assert page.get_by_text(re.compile(r"확인된 신청 \d+건")).is_visible()
    assert page.get_by_text("전원이 켜지지 않아요", exact=True).is_visible()
    page.get_by_role("button", name="조회 종료").click()
    page.wait_for_load_state("networkidle")
    assert re.search(r"/requests/?$", page.url), (
        f"unexpected logout URL: {page.url}; body={page.locator('body').inner_text()}"
    )
    assert page.get_by_label("휴대전화 번호").is_visible()

    # 조회 화면도 같은 정규화를 거치므로 하이픈 없이 입력해도 찾아야 한다.
    lookup_phone = page.get_by_label("휴대전화 번호")
    lookup_phone.click()
    lookup_phone.press_sequentially("01012345678")
    assert lookup_phone.input_value() == "010-1234-5678"
    page.get_by_label("신청 비밀번호").fill("test1234")
    page.get_by_role("button", name="내 신청 조회", exact=True).click()
    page.wait_for_url(re.compile(r"/requests\?unlocked=1"))
    page.wait_for_load_state("networkidle")
    assert page.get_by_text(re.compile(r"확인된 신청 \d+건")).is_visible()

    page.goto(f"{BASE_URL}/admin/setup", wait_until="networkidle")
    if page.get_by_role("heading", name="운영자 비밀번호 설정").count():
        page.get_by_label("최초 설정 토큰").fill(SETUP_TOKEN)
        page.get_by_label("새 운영자 비밀번호", exact=True).fill("StrongLocalAdmin123!")
        page.get_by_label("새 비밀번호 확인", exact=True).fill("StrongLocalAdmin123!")
        page.get_by_role("button", name="운영자 비밀번호 저장").click()
        page.wait_for_url(re.compile(r"/admin/login\?setup=done"))
        page.wait_for_load_state("networkidle")

    page.goto(f"{BASE_URL}/admin/login", wait_until="networkidle")
    page.get_by_label("아이디").fill("admin")
    page.get_by_label("비밀번호", exact=True).fill("StrongLocalAdmin123!")
    page.get_by_role("button", name="로그인").click()
    page.wait_for_url(f"{BASE_URL}/admin")
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="서비스 접수 관리").is_visible()
    assert page.get_by_role("heading", name="접수내역 검색").is_visible()
    assert page.get_by_role("columnheader", name="번호").is_visible()
    assert page.get_by_role("columnheader", name="담당자").is_visible()
    assert page.get_by_role("columnheader", name="접수구분").count() == 0
    assert page.locator('select[name="receiptType"]').count() == 0
    assert page.get_by_role("link", name="미상").first.is_visible()
    assert (
        page.get_by_role("table").locator("tbody tr").first.locator("td").first.inner_text()
        == "1"
    )
    page.screenshot(path=str(ARTIFACTS / "admin-ledger-desktop.png"), full_page=True)

    # 운영자만 직원 계정을 만들 수 있고 숫자 4자리 비밀번호를 발급할 수 있다.
    page.get_by_role("link", name="직원 관리").click()
    page.wait_for_url(f"{BASE_URL}/admin/staff")
    page.get_by_label("직원명").fill("테스트 담당자")
    page.get_by_label("로그인 아이디").fill("staff01")
    staff_phone = page.get_by_label("연락처")
    assert staff_phone.get_attribute("maxlength") is None
    staff_phone.press_sequentially("01022223333")
    assert staff_phone.input_value() == "010-2222-3333"
    page.get_by_label("숫자 비밀번호").fill("1234")
    page.get_by_role("button", name="직원 등록").click()
    page.wait_for_url(re.compile(r"/admin/staff\?status=created"))
    assert page.get_by_role("heading", name="테스트 담당자").is_visible()
    page.get_by_role("link", name="신청내역").click()
    page.wait_for_url(f"{BASE_URL}/admin")
    page.wait_for_load_state("networkidle")

    page.get_by_role("link", name="미상").first.click()
    page.wait_for_url(re.compile(r"/admin/requests/R-\d{8}-[A-F0-9]{6}"))
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="미상 고객 접수").is_visible(), (
        f"unexpected detail page: {page.url}; body={page.locator('body').inner_text()}"
    )
    # 접수구분은 운영자 화면에서 완전히 제거되었다.
    assert page.get_by_label("접수구분 *").count() == 0
    assert page.get_by_label("사무실입금액").count() == 0
    page.get_by_label("담당자", exact=True).select_option(label="테스트 담당자 · staff01")
    page.get_by_role("button", name="담당자 배정").click()
    assert page.get_by_text("담당자 배정을 저장했습니다.", exact=True).first.is_visible()
    page.get_by_label("방문구분").select_option(label="즉시")
    page.get_by_label("고객분류 *").select_option(label="재방문고객")

    # 결제방법·총수금액·자재비를 입력하면 두 부가세와 기사수익이 즉시 파생되어야 한다.
    page.get_by_label("결제방법").select_option(label="카드 결제")
    page.get_by_label("총수금액").fill("1100000")
    page.get_by_label("자재비").fill("100000")
    settlement = page.locator(".admin-derived-amount")
    assert settlement.nth(0).inner_text().startswith("100,000 원"), (
        f"총수금액 부가세 자동 계산 실패: {settlement.nth(0).inner_text()}"
    )
    assert settlement.nth(1).inner_text().startswith("10,000 원"), (
        f"자재비 부가세 자동 계산 실패: {settlement.nth(1).inner_text()}"
    )
    assert settlement.nth(2).inner_text().startswith("890,000 원"), (
        f"기사수익 자동 계산 실패: {settlement.nth(2).inner_text()}"
    )

    save_button = page.get_by_role("button", name="저장", exact=True)
    save_button.scroll_into_view_if_needed()
    detail_url = page.url
    scroll_before_save = page.evaluate("window.scrollY")
    save_button.click()
    page.get_by_text("접수 내역을 저장했습니다.", exact=True).wait_for()
    assert page.url == detail_url
    assert abs(page.evaluate("window.scrollY") - scroll_before_save) < 5
    assert page.get_by_label("담당자", exact=True).input_value() != ""
    assert page.get_by_label("방문구분").input_value() == "즉시"
    # 저장 후에도 파생 금액이 유지되고, 고객이 쓴 긴 접수 내용이 잘리지 않아야 한다.
    assert page.get_by_label("총수금액").input_value() == "1100000"
    assert page.get_by_label("결제방법").input_value() == "카드 결제"
    assert page.locator(".admin-derived-amount").nth(2).inner_text().startswith("890,000 원")
    saved_description = page.get_by_label("장애현상 *").input_value()
    assert len(saved_description) == len(long_description.strip()), (
        f"운영자 저장 후 접수 내용이 잘렸습니다: {len(saved_description)}"
        f" / {len(long_description.strip())}"
    )
    with page.expect_navigation(wait_until="networkidle"):
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
    assert page.get_by_label("아이디").input_value() == "admin"
    page.get_by_label("비밀번호", exact=True).fill("ChangedLocalAdmin456!")
    page.get_by_role("button", name="로그인").click()
    page.wait_for_url(f"{BASE_URL}/admin")
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="서비스 접수 관리").is_visible()

    # 직원은 같은 로그인 화면을 사용하지만 본인에게 배정된 신청만 볼 수 있다.
    page.get_by_role("button", name="로그아웃").click()
    page.wait_for_url(f"{BASE_URL}/admin/login")
    assert page.get_by_label("아이디").input_value() == "admin"
    page.get_by_label("아이디").fill("staff01")
    page.get_by_label("비밀번호", exact=True).fill("1234")
    page.get_by_role("button", name="로그인").click()
    page.wait_for_url(f"{BASE_URL}/admin")
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="내 배정 신청").is_visible()
    assert page.get_by_role("link", name="직원 관리").count() == 0
    assert page.get_by_role("table").locator("tbody tr").count() == 1
    page.get_by_role("link", name="미상").first.click()
    page.wait_for_url(re.compile(r"/admin/requests/R-\d{8}-[A-F0-9]{6}"))
    page.wait_for_load_state("networkidle")
    assert page.get_by_label("자재비").count() == 0
    assert page.get_by_text("운영자만 입력·수정", exact=True).is_visible()

    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto(f"{BASE_URL}/admin", wait_until="networkidle")
    assert mobile.locator(".admin-request-card").count() == 1
    assert mobile.locator(".admin-request-card").is_visible()
    assert not mobile.locator(".admin-request-table-wrap").is_visible()
    assert mobile.get_by_role("link", name="상세보기 / 수정하기").is_visible()
    mobile.screenshot(path=str(ARTIFACTS / "admin-mobile-cards.png"), full_page=True)

    mobile.goto(f"{BASE_URL}/requests", wait_until="networkidle")
    assert mobile.get_by_role("heading", name="내 신청 조회", exact=True).is_visible()
    mobile.screenshot(path=str(ARTIFACTS / "lookup-mobile.png"), full_page=True)
    mobile.close()

    assert not browser_errors, f"browser errors: {browser_errors}"
    browser.close()
