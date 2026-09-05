import os
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("BLOG_UI_BASE_URL", "http://127.0.0.1:5173")
ARTIFACTS = Path(__file__).parent / "artifacts"


def verify_page(page, screenshot_name: str, expect_single_column: bool) -> None:
    page.goto(f"{BASE_URL}/#repair-cases", wait_until="networkidle")
    section = page.locator("#repair-cases")
    quick_request_close = page.get_by_label("빠른 신청 닫기")
    if quick_request_close.is_visible():
        quick_request_close.click()
    section.wait_for(state="visible")
    assert page.url.endswith("/#repair-cases")
    assert page.get_by_role("heading", name="실제 수리 과정을 확인하세요").is_visible()
    assert section.get_by_role("list", name="수리사례 기록 원칙").locator("li").count() == 4
    apply_link = section.get_by_role("link", name="비슷한 증상 수리 신청")
    assert apply_link.get_attribute("href") == "/requests/new"
    blog_link = section.get_by_role("link", name="컴박사 블로그 전체 보기")
    assert blog_link.get_attribute("href") == "https://blog.naver.com/combaksa_repair"
    section_box = section.bounding_box()
    final_box = page.locator(".final-cta").bounding_box()
    assert section_box and final_box and section_box["y"] < final_box["y"]
    cards = section.locator(".blog-note-card")
    if cards.count() >= 2:
        first_card = cards.nth(0).bounding_box()
        second_card = cards.nth(1).bounding_box()
        assert first_card and second_card
        if expect_single_column:
            assert abs(first_card["x"] - second_card["x"]) < 2
            assert second_card["y"] > first_card["y"]
        else:
            assert second_card["x"] > first_card["x"]
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(ARTIFACTS / screenshot_name), full_page=False)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    desktop = browser.new_page(viewport={"width": 1920, "height": 1080})
    verify_page(desktop, "blog-home-desktop.png", expect_single_column=False)
    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    verify_page(mobile, "blog-home-mobile.png", expect_single_column=True)
    browser.close()
