# Project brief

## Description

A panoramic natural-language typewriter clock for the 3840 × 804 Melbourne gallery screen, optimised for NVIDIA Shield and mobile preview.

## Build brief

Purpose:
Create an original word-based clock for the fixed 3840 × 804 gallery display. It must not use a QLOCKTWO-style fixed letter matrix or pre-existing hidden words. The current time is generated as a natural-language sentence and animated like text being edited in a terminal or typewriter.

Core display:
- Fixed 3840 × 804 production canvas.
- Aurecon Grey #373A36 background, warm white main text and restrained Aurecon Green #89C925 accents.
- Small heading: THE TIME NOW IS.
- Large natural-language Melbourne time, such as TWENTY-SIX MINUTES PAST SIX.
- Small Melbourne date/location metadata.
- A thin 60-second progress line.

Animation behaviour:
- On first load, type the current phrase character by character with a blinking cursor.
- On each minute change, preserve all unchanged text.
- Compute the common prefix and suffix, move the cursor to the changed section, backspace only the changed characters, then type the replacement.
- Do not animate characters that have not changed.
- Rewrite the full phrase only when the language genuinely has no useful shared structure.
- Keep the clock calculation live while animation is running and resynchronise to the current Melbourne minute after every edit.

Language rules:
- Use exact minute wording rather than five-minute rounding.
- ONE MINUTE PAST SIX, TWO MINUTES PAST SIX, QUARTER PAST SIX, HALF PAST SIX, QUARTER TO SEVEN, ONE MINUTE TO SEVEN, SIX O'CLOCK, NOON and MIDNIGHT.
- Australian English and 12-hour spoken time.

Performance and compatibility:
- Vanilla HTML, CSS and JavaScript only.
- No frameworks, Canvas, WebGL, external APIs or runtime libraries.
- Animate only during typing/deleting/cursor movement.
- Use transform and opacity where possible.
- Lock time to Australia/Melbourne using Intl.DateTimeFormat.
- Include robust catch-up logic after browser sleep or signage reload.
- Lightweight enough for NVIDIA Shield signage playback.

Preview and controls:
- Automatically scale the 3840 × 804 stage to any browser viewport.
- Provide a mobile-friendly preview and a portrait rotate-device prompt.
- Add ?demo=1 to advance through representative time phrases quickly for sign-off.
- Add ?noanim=1 to show the current phrase instantly.
- Add ?debug=1 for safe-area and stage-boundary overlays.

Privacy and deployment:
- GitHub Pages.
- noindex, nofollow, noarchive and nosnippet metadata.
- robots.txt disallow.
- No analytics or external dependencies.

Quality control:
- Test exact 3840 × 804 output.
- Test desktop scaling, iPhone portrait prompt and landscape mobile preview.
- Test phrase generation for all 1,440 minutes of a day.
- Test the selective edit algorithm across every consecutive minute transition.
- Confirm no overflow, clipping, sub-pixel stage sizing or stale time after animation.
- Include a README with Shield deployment, query controls and QC results.
