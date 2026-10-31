<p align="center">
  <img src="public/icons/icon-192.png" alt="GitStream logo" width="96" height="96" />
</p>

<h1 align="center">GitStream</h1>

<p align="center">
  <a href="LICENSE.md"><img src="https://img.shields.io/github/license/han41858/git-stream?label=License" alt="License: MIT" /></a>
  <a href="https://github.com/han41858/git-stream/releases"><img src="https://img.shields.io/github/v/release/han41858/git-stream?sort=date&amp;display_name=tag&amp;label=Latest%20Release" alt="Latest Release" /></a>
</p>

<p align="center"><strong>Watch your Git history unfold.</strong></p>
<p align="center">Explore GitHub history directly in your browser.</p>
<p align="center">Read-only · Web app · PWA</p>

<p align="center">
  <a href="https://git-stream-view.vercel.app/?repo=han41858%2Fgit-stream"><strong>Live Demo</strong></a>
  · <a href="#getting-started">Get started</a>
  · <a href="#development--documentation">Documentation</a>
</p>

![GitStream on desktop, showing the public GitStream repository and its commit graph](docs/images/desktop.png)

<table>
  <tr><th>Automatic refresh</th><th>Mobile</th></tr>
  <tr>
    <td width="68%" align="center" valign="top"><img src="docs/images/auto-refresh.gif" alt="A newly pushed commit appearing automatically in GitStream after a scheduled refresh" width="680" /></td>
    <td width="32%" align="center" valign="top"><img src="docs/images/mobile.png" alt="GitStream's responsive mobile view of the same public repository" width="200" /></td>
  </tr>
</table>

*Actual app captures using the public GitStream repository. [Capture details](docs/images/README.md).*

## Features

- **Follow branches and merges** in an interactive, vertical Git graph.
- **Stay current** with automatic updates that preserve your place while reading.
- **See the context** with tags, releases and GitHub Actions status beside commits.
- **Explore public and private repositories**, with optional GitHub token access.
- **Use it anywhere** on desktop or mobile, or install it as a PWA.

## Getting started

1. Open the [Live Demo](https://git-stream-view.vercel.app/?repo=han41858%2Fgit-stream).
2. Enter `owner/repo` or a GitHub repository URL and press Enter.
3. Choose a branch, scroll through history and select a commit for details.

Use **Options** to choose a theme and refresh interval. Install GitStream from your browser's app menu or add it to your home screen. The PWA caches the app shell; GitHub data still needs a connection.

### Private repositories and API limits

Public repositories work without a token. For private repositories or higher API limits, create a **fine-grained personal access token** for the repositories you choose, then apply it in **Token**.

| Permission | Access | Used for |
| --- | --- | --- |
| Contents | Read-only | Commits, branches, tags and releases |
| Pull requests | Read-only | PR-based branch suggestions |
| Actions | Read-only | Workflow runs and jobs |

The token is saved in this browser's localStorage and sent only to `api.github.com`. **Remove token & clear history** removes the saved token and displayed history. See the [technical guide](docs/technical-guide.md#use) for access checks, rate limits and storage behavior.

## Development & documentation

Use **Node.js 24.x** and npm:

```sh
npm ci
npm run dev
```

- [Technical guide](docs/technical-guide.md) — usage, architecture, API behavior, tests, deployment and releases.
- [Product specification](docs/specification.md) · [Refresh and metadata](docs/auto-refresh-and-metadata.md) — implementation specifications.
- [PWA](docs/pwa.md) · [Developer diagnostics](docs/developer-debug-mode.md) — installation, updates, recovery and local measurements.

Ideas and bug reports are welcome in [Issues](https://github.com/han41858/git-stream/issues).

## License

[MIT](LICENSE.md) © 2026 Han Jang-hyun.
