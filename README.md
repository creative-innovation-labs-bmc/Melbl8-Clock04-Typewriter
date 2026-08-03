# Melbourne Typewriter Clock

An original natural-language clock for the fixed **3840 × 804** Melbourne gallery screen. The live sentence is typed on first load, then edited surgically at each minute change: unchanged text remains in place while the cursor moves to the changed section, deletes it and types the replacement.

This is not a fixed letter matrix. Every displayed phrase is generated at runtime.

## Production behaviour

- Locked to `Australia/Melbourne` using `Intl.DateTimeFormat`.
- Exact minute wording, not five-minute rounding.
- Special phrases for `NOON`, `MIDNIGHT`, `QUARTER PAST`, `HALF PAST` and `QUARTER TO`.
- Fixed 3840 × 804 stage with automatic viewport scaling.
- Portrait phones receive a rotate-device prompt.
- A restrained progress line tracks the current second.
- No framework, Canvas, WebGL, external API, analytics or runtime dependency.
- Noindex metadata and `robots.txt` disallow crawling.

## Query controls

| Query | Purpose |
|---|---|
| `?demo=1` | Advances one displayed minute every five seconds for sign-off. |
| `?demo=1&interval=3000` | Changes the demo interval in milliseconds. Minimum 1800. |
| `?time=18:06` | Locks the preview to a specific phrase. |
| `?noanim=1` | Displays the phrase immediately. |
| `?debug=1` | Shows the production safe area and stage label. |

Queries can be combined, for example `?demo=1&debug=1`.

## NVIDIA Shield notes

- Use the normal GitHub Pages URL without query parameters for production.
- Keep browser/page zoom at 100%.
- The production canvas is always 3840 × 804 and scales only for non-production previews.
- The page recalculates Melbourne time after browser visibility changes and signage reloads.
- Only text nodes and the cursor are animated, keeping the rendering workload low.

## Quality control

Run:

```bash
npm test
python3 tests/browser-qc.py
```

The test suite checks:

- all 1,440 minute phrases;
- every consecutive minute edit plan;
- exact 3840 × 804 stage dimensions;
- longest representative phrase containment;
- mobile portrait prompt;
- mobile landscape scaling;
- live selective text replacement.

### Completed QC, 3 August 2026

- 5 of 5 unit tests passed.
- All 1,440 phrases passed spelling and formatting checks.
- All consecutive minute transitions reconstructed the correct target phrase.
- Native Chromium layout measured exactly 3840 × 804.
- The representative long phrase stayed inside the 160 px safe margins at full size.
- iPhone portrait displayed the rotate prompt.
- Mobile landscape scaled the entire gallery canvas inside the viewport.
- A live 6:06 to 6:07 transition isolated and preserved ` MINUTES PAST SIX`, deleted only `IX`, then typed `EVEN`.
