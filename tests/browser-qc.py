from __future__ import annotations

import json
import re
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "qc-output"
OUT.mkdir(exist_ok=True)


def inline_document(query: str) -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "style.css").read_text(encoding="utf-8")
    core = (ROOT / "clock-core.js").read_text(encoding="utf-8").replace("export ", "")
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    app = re.sub(r"^import .*?;\n", "", app, count=1)
    app = app.replace(
        "const params = new URLSearchParams(window.location.search);",
        f"const params = new URLSearchParams({json.dumps(query)});",
    )
    html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>{css}</style>")
    html = html.replace(
        '<script type="module" src="app.js"></script>',
        f"<script>{core}\n{app}</script>",
    )
    return html


def load(page: Page, query: str) -> None:
    page.set_content(inline_document(query), wait_until="load")
    page.wait_for_function(
        "window.__clock && window.__clock.renderedText.length > 0 && window.__clock.leadText.length > 0"
    )


def bounds(page: Page, selector: str) -> dict[str, float]:
    value = page.locator(selector).bounding_box()
    assert value is not None, f"No bounding box for {selector}"
    return value


def main() -> None:
    results: dict[str, object] = {}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium")

        page = browser.new_page(viewport={"width": 3840, "height": 804}, device_scale_factor=1)
        load(page, "?time=11:29&noanim=1")
        stage = bounds(page, "#stage")
        lead = bounds(page, "#leadLine")
        time_line = bounds(page, "#timeLine")
        assert round(stage["width"]) == 3840
        assert round(stage["height"]) == 804
        assert lead["x"] >= 159
        assert time_line["x"] >= 159
        assert lead["x"] + lead["width"] <= 3681
        assert time_line["x"] + time_line["width"] <= 3681
        assert page.locator("#timeLine").inner_text() == "Twenty-nine minutes past eleven"
        assert page.locator("#leadLine").inner_text()[0].isupper()
        lead_size = page.locator("#leadLine").evaluate("element => getComputedStyle(element).fontSize")
        time_size = page.locator("#timeLine").evaluate("element => getComputedStyle(element).fontSize")
        assert lead_size == time_size
        cursor_margin = page.locator("#timeCursor").evaluate("element => getComputedStyle(element).marginLeft")
        assert float(cursor_margin.removesuffix("px")) > 10
        page.screenshot(path=str(OUT / "native-3840x804.png"), full_page=True)
        results["native"] = {
            "stage": stage,
            "lead": lead,
            "time": time_line,
            "font_size": time_size,
            "cursor_margin_left": cursor_margin,
        }
        page.close()

        portrait = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        load(portrait, "?time=18:06&noanim=1")
        assert portrait.locator("#rotatePrompt").is_visible()
        portrait.screenshot(path=str(OUT / "mobile-portrait.png"), full_page=True)
        results["mobile_portrait_prompt"] = True
        portrait.close()

        landscape = browser.new_page(viewport={"width": 844, "height": 390}, device_scale_factor=1)
        load(landscape, "?time=18:06&noanim=1")
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
        load(edit, "?time=18:06&noanim=1")
        edit.evaluate("window.__clock.forcePhrase('Seven minutes past six')")
        edit.wait_for_function("window.__clock.renderedText === 'Seven minutes past six'")
        assert edit.locator("#timeLine").inner_text() == "Seven minutes past six"
        results["selective_edit"] = True
        edit.close()

        dynamic = browser.new_page(viewport={"width": 3840, "height": 804}, device_scale_factor=1)
        load(dynamic, "?time=18:06&noanim=1")
        initial_size = dynamic.evaluate("window.__clock.messageFontSize")
        dynamic.evaluate("window.__clock.forceLead('Here in Melbourne, it is')")
        dynamic.wait_for_function("window.__clock.leadText === 'Here in Melbourne, it is'")
        long_lead_size = dynamic.evaluate("window.__clock.messageFontSize")
        assert long_lead_size <= initial_size
        results["dynamic_shared_scale"] = {
            "initial": initial_size,
            "long_lead": long_lead_size,
        }
        dynamic.close()

        browser.close()

    (OUT / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
