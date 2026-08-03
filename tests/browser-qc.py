from __future__ import annotations

import contextlib
import http.server
import json
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "qc-output"
OUT.mkdir(exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


def run_server() -> tuple[socketserver.TCPServer, int]:
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs)
    server = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = int(server.server_address[1])
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port


def bounds(page, selector: str) -> dict[str, float]:
    value = page.locator(selector).bounding_box()
    assert value is not None, f"No bounding box for {selector}"
    return value


def main() -> None:
    server, port = run_server()
    base = f"http://127.0.0.1:{port}"
    results: dict[str, object] = {}

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium")

            page = browser.new_page(viewport={"width": 3840, "height": 804}, device_scale_factor=1)
            page.goto(f"{base}/?time=11:29&noanim=1", wait_until="networkidle")
            page.wait_for_function("window.__clock && window.__clock.renderedText.length > 0")
            stage = bounds(page, "#stage")
            phrase = bounds(page, "#phrase")
            assert round(stage["width"]) == 3840
            assert round(stage["height"]) == 804
            assert phrase["x"] >= 159
            assert phrase["x"] + phrase["width"] <= 3681
            assert page.locator("#phrase").inner_text() == "TWENTY-NINE MINUTES PAST ELEVEN"
            page.screenshot(path=str(OUT / "native-3840x804.png"), full_page=True)
            results["native"] = {"stage": stage, "phrase": phrase}
            page.close()

            portrait = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
            portrait.goto(f"{base}/?time=18:06&noanim=1", wait_until="networkidle")
            assert portrait.locator("#rotatePrompt").is_visible()
            portrait.screenshot(path=str(OUT / "mobile-portrait.png"), full_page=True)
            results["mobile_portrait_prompt"] = True
            portrait.close()

            landscape = browser.new_page(viewport={"width": 844, "height": 390}, device_scale_factor=1)
            landscape.goto(f"{base}/?time=18:06&noanim=1", wait_until="networkidle")
            landscape.wait_for_function("window.__clock && window.__clock.renderedText.length > 0")
            assert not landscape.locator("#rotatePrompt").is_visible()
            landscape_stage = bounds(landscape, "#stage")
            assert landscape_stage["x"] >= -1
            assert landscape_stage["y"] >= -1
            assert landscape_stage["x"] + landscape_stage["width"] <= 845
            assert landscape_stage["y"] + landscape_stage["height"] <= 391
            landscape.screenshot(path=str(OUT / "mobile-landscape.png"), full_page=True)
            results["mobile_landscape"] = landscape_stage
            landscape.close()

            edit = browser.new_page(viewport={"width": 1600, "height": 500}, device_scale_factor=1)
            edit.goto(f"{base}/?time=18:06&noanim=1", wait_until="networkidle")
            edit.wait_for_function("window.__clock && window.__clock.renderedText === 'SIX MINUTES PAST SIX'")
            edit.evaluate("document.body.dataset.qc = 'editing'")
            edit.evaluate("window.__clock.forcePhrase('SEVEN MINUTES PAST SIX')")
            edit.wait_for_function("window.__clock.renderedText === 'SEVEN MINUTES PAST SIX'")
            assert edit.locator("#phrase").inner_text() == "SEVEN MINUTES PAST SIX"
            results["selective_edit"] = True
            edit.close()

            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    (OUT / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
