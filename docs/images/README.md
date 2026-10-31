# README capture notes

These files are screenshots and a screen recording of the actual GitStream app. They are not UI mockups or generated illustrations.

- Captured on **2026-10-31 (Asia/Seoul)** using a local Production build.
- App source: `a67e095ca8c1c73ae7eadec83ce4f48e68cf31c0`, with the same file tree as Production commit `026250deb316ec2686c356d358556dd2bfb48f7e`.
- Data: live responses from the public [`han41858/git-stream`](https://github.com/han41858/git-stream) repository. No fixture commits, fabricated workflow states or app-code changes were used.
- The cloud browser could not trust the environment's outbound proxy certificate. A local read-only transport relayed real GitHub API responses with Python's normal TLS verification; response bodies were not changed. No PAT was entered into the app.
- The desktop capture shows commit `026250d`, its real tag/release and completed Actions. The mobile capture selects commit `9fdf3ad` to show the responsive graph and a compact workflow detail panel.
- Mobile is Chromium touch/viewport emulation, not a photograph of a physical phone or an OS-level PWA installation.

| File | Viewport | Content |
| --- | --- | --- |
| `desktop.png` | 1280 × 800 | Desktop graph with commit, release and workflow details |
| `mobile.png` | 390 × 844 | Mobile graph with touch-selected commit details |
| `auto-refresh.gif` | 1040 × 650 | Approximately 8.1 seconds, 65 real frames at about 8 fps |

The GIF records the end of the app's normal **one-minute automatic refresh interval**. The browser clock was not advanced, and no manual refresh was clicked during filming. It shows real request activity followed by the updated refresh time. GitHub returned 200 and conditional 304 responses; the repository did not gain a new commit during this recorded check.

PNG captures were saved directly from the browser. The GIF was encoded from the captured PNG frames with FFmpeg; no app elements, labels or data were composited into the frames. File sizes are approximately 232 KiB (desktop), 47 KiB (mobile) and 78 KiB (GIF).

## Reproduce the captures

1. Run `npm ci`, `npm run build` and `npm run preview` from the repository root.
2. Open `/?repo=han41858%2Fgit-stream` in a fresh browser profile and use the dark theme.
3. Set the desktop/mobile viewport sizes listed above and select a real commit through the graph. Wait for request activity to settle before saving a PNG.
4. For the GIF, choose a one-minute refresh interval in Options and record the actual scheduled check. Do not advance the browser clock or substitute API fixtures.

Live repository contents and workflow states can change, so later captures need not have the same commit count or timestamps.
