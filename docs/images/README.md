# README capture notes

- Captured on **2026-10-31 (Asia/Seoul)** using a local Production build.
- App source: `a67e095ca8c1c73ae7eadec83ce4f48e68cf31c0`, with the same file tree as Production commit `026250deb316ec2686c356d358556dd2bfb48f7e`.
- Repository: [`han41858/git-stream`](https://github.com/han41858/git-stream), using live public GitHub data.
- Selected commits: `026250d` on desktop and `9fdf3ad` on mobile.
- Mobile uses Chromium touch/viewport emulation; a physical device or OS-level PWA installation was not captured.

| File | Viewport | Content |
| --- | --- | --- |
| `desktop.png` | 1280 × 800 | Desktop graph with commit, release and workflow details |
| `mobile.png` | 390 × 844 | Mobile graph with touch-selected commit details |
| `auto-refresh.gif` | 1040 × 650 | Approximately 8.1 seconds, 65 real frames at about 8 fps |

The GIF records a normal one-minute automatic refresh, showing request activity and the updated refresh time. No new commit arrived during this recording.

## Reproduce the captures

1. Run `npm ci`, `npm run build` and `npm run preview` from the repository root.
2. Open `/?repo=han41858%2Fgit-stream` in a fresh browser profile and use the dark theme.
3. Set the desktop/mobile viewport sizes listed above and select a real commit through the graph. Wait for request activity to settle before saving a PNG.
4. For the GIF, choose a one-minute refresh interval in Options and record the scheduled check.

Live repository contents and workflow states can change, so later captures need not have the same commit count or timestamps.
