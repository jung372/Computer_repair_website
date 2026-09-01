import os
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("BLOG_UI_BASE_URL", "http://127.0.0.1:5173")
ARTIFACTS = Path(__file__).parent / "artifacts"


def verify_page(page, screenshot_name: str) -> None:
    page.goto(BASE_URL, wait_until="networkidle")
    section = page.locator(".blog-notes-section")
    section.scroll_into_view_if_needed()
    quick_request_close = page.get_by_label("빠른 신청 닫기")
    if quick_request_close.is_visible():
        quick_request_close.click()
    section.wait_for(state="visible")
    assert page.get_by_role("heading", name="컴박사가 직접 정리한 수리 노트").is_visible()
    blog_link = section.get_by_role("link", name="컴박사 블로그 전체 보기")
    assert blog_link.get_attribute("href") == "https://blog.naver.com/combaksa_repair"
    section_box = section.bounding_box()
    final_box = page.locator(".final-cta").bounding_box()
    assert section_box and final_box and section_box["y"] < final_box["y"]
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(ARTIFACTS / screenshot_name), full_page=False)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    desktop = browser.new_page(viewport={"width": 1920, "height": 1080})
    verify_page(desktop, "blog-home-desktop.png")
    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    verify_page(mobile, "blog-home-mobile.png")
    browser.close()
