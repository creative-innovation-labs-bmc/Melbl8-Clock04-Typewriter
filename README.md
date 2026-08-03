# Melbourne Typewriter Clock

An original natural-language clock for the fixed **3840 × 804** Melbourne gallery screen. The display uses two equal-size sentence-case lines. The first line rotates through different ways of introducing the time, while the second line states the current Melbourne time.

The live text types on first load, then edits surgically at each minute change. Unchanged text remains in place while the cursor moves to the changed section, deletes it and types the replacement.

This is not a fixed letter matrix. Every displayed phrase is generated at runtime.

## Typography

- Uses the approved `MP-B.ttf` asset from `Melbl8-Clock03-Split-flap`.
- The GitHub Pages workflow copies that exact font into the deployed site as a same-origin asset.
- Both main lines always use the same font size.
- The shared size is recalculated from the longest current or incoming line, preserving the font's proportions rather than horizontally squeezing it.
- The cursor has additional end spacing so it does not touch the final letter.

## Lead-in rotation

The first line uses a shuffled deck and does not repeat an option until all alternatives have been shown. Examples include:

- The time now is
- Right now, it is
- At this moment, it is
- The current time is
- Here in Melbourne, it is
- Melbourne time is
- The clock says
- It is currently
- As of now, it is

## Production behaviour

- Locked to `Australia/Melbourne` using `Intl.DateTimeFormat`.
- Exact minute wording, not five-minute rounding.
- Sentence-case phrases such as `Twenty-nine minutes past eleven`.
- Special phrases for `Noon`, `Midnight`, `Quarter past`, `Half past` and `Quarter to`.
- Fixed 3840 × 804 stage with automatic viewport scaling.
- Portrait phones receive a rotate-device prompt.
- A restrained progress line tracks the current second.
- No framework, Canvas, WebGL, external API or analytics.
- Noindex metadata and `robots.txt` disallow crawling.

## Query controls

| Query | Purpose |
|---|---|
| `?demo=1` | Advances one displayed minute every five seconds for sign-off. |
| `?demo=1&interval=3000` | Changes the demo interval in milliseconds. Minimum 1800. |
| `?time=18:06` | Locks the preview to a specific phrase. |
| `?noanim=1` | Displays both lines immediately. |
| `?debug=1` | Shows the production safe area and stage label. |

Queries can be combined, for example `?demo=1&debug=1`.

## NVIDIA Shield notes

- Use the normal GitHub Pages URL without query parameters for production.
- Keep browser or page zoom at 100%.
- The production canvas is always 3840 × 804 and scales only for non-production previews.
- The page recalculates Melbourne time after browser visibility changes and signage reloads.
- Only two text lines and one cursor animate, keeping the rendering workload low.

## Quality control

Run:

```bash
npm test
python3 tests/browser-qc.py
```

The test suite checks:

- all 1,440 sentence-case minute phrases;
- every consecutive minute edit plan;
- exact 3840 × 804 stage dimensions;
- equal sizing of both main lines;
- longest representative phrase containment;
- additional cursor spacing;
- mobile portrait prompt;
- mobile landscape scaling;
- live selective text replacement.
