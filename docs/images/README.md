# README capture notes

Screenshots and a screen recording of the actual GitStream app, used in the project README.

- Captured on **2026-10-31 (Asia/Seoul)** from a local Production build of commit `a67e095` (same file tree as Production commit `026250d`).
- Data: live responses from the public [`han41858/git-stream`](https://github.com/han41858/git-stream) repository. No token was used.
- The desktop capture shows commit `026250d` with its tag, release and completed Actions. The mobile capture selects commit `9fdf3ad`.
- Mobile is Chromium touch/viewport emulation, not a physical device or an installed PWA.

| File | Viewport | Content |
| --- | --- | --- |
| `desktop.png` | 1280 × 800 | Desktop graph with commit, release and workflow details |
| `mobile.png` | 390 × 844 | Mobile graph with touch-selected commit details |
| `auto-refresh.gif` | 1040 × 650 | About 8 seconds around a scheduled one-minute automatic refresh |

The GIF shows the refresh button's progress, the request indicator and the updated refresh time. No new commit arrived during the recorded check.

## Reproduce the captures

1. Run `npm ci`, `npm run build` and `npm run preview` from the repository root.
2. Open `/?repo=han41858%2Fgit-stream` in a fresh browser profile and use the dark theme.
3. Set the viewport sizes listed above and select a commit in the graph. Wait for request activity to settle before saving a PNG.
4. For the GIF, choose a one-minute refresh interval in Options and record the actual scheduled check.

Repository contents and workflow states change over time, so later captures will differ.
