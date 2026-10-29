# GitStream

Explore the flow of Git history. A responsive, read-only GitHub commit DAG viewer, built with React, TypeScript, Vite and Canvas 2D. No backend or database.

## Development

Node.js 22+ and npm are recommended.

```sh
npm ci
npm run dev
npm test
npm run build
```

Deploy `dist/` to any static host. Repository selection uses `?repo=owner%2Frepo` and survives refresh without server rewrites.

## Use

Enter `owner/repo` or `https://github.com/owner/repo`. The default branch loads first, up to 100 commits per page. Select another branch to load its unique history and highlight ancestors; use **Load older commits** for subsequent pages. Branch references also paginate. “All loaded history” only means the loaded subset, never the entire repository. Dashed edges indicate unloaded parents. Select the time direction without changing graph relationships. Hover, tap, or use the accessible commit selector to inspect a commit.

For private repositories, supply a fine-grained PAT limited to selected repositories with **Contents: Read-only**. It is held only in React memory, sent only to `api.github.com`, and cleared on reload. Removing it also clears displayed history. No persistent token storage or analytics. Unauthenticated GitHub API rate limits apply.

## Architecture and limits

`model.ts` owns data and topological lane layout; `api.ts` owns paginated REST requests; `Graph.tsx` draws viewport nodes and intersecting edges on a DPR-aware canvas. Branch refs and lanes are separate. Commit identity is deduplicated by SHA. Parent relationships, rather than dates, determine order. Parent lanes are reused where possible, with earlier assignments preferred as pages arrive.

The canvas bounds its drawing to the viewport, but layout and edge traversal still process loaded history. No claim of unlimited history: 10,000 synthetic commits are covered by automated tests; live large-repository and 100,000-commit performance still need measurement. Loading is explicit to control API usage. No offline cache; private history remains visible in memory until cleared or refreshed. GitHub access depends on the browser network policy and API quota.

## Deploy to Vercel

The repository includes `vercel.json`. Use Node.js **24.x**, framework **Vite**, install command `npm ci --no-audit --no-fund`, build command `npm run build`, and output directory `dist`. No backend, functions, environment variables, or build-time GitHub token are required. Never add a PAT as a `VITE_*` variable: those values would be public in the browser bundle.

### Git integration

1. Commit and push the implementation to GitHub when ready. Files created only in this workspace are not available to Vercel's Git integration yet.
2. In Vercel, choose **Add New → Project** and import `han41858/git-stream`.
3. Set **Root Directory** to the repository root (leave it at the default). `/workspace/git-stream` is only this cloud machine's checkout path.
4. Confirm the settings above and deploy. Use the Vercel preview deployment for the checks below before promoting to production.

Alternatively, from the repository root on a machine authenticated with Vercel, run `npx vercel` for a preview. Run `npx vercel --prod` only when you intend to publish to production. CLI authentication and project linking are performed on that machine, not embedded in this project.

### Before publishing

```sh
npm ci --no-audit --no-fund
npm test
npm run build
npm run preview -- --port 4173
```

On the deployment, open a public repository such as `han41858/git-stream` and `angular/angular`; verify real commit data, branch selection, loading older history, direction reversal, commit links, and refreshing a `?repo=owner%2Frepo` URL. Test mobile tap and horizontal scrolling. A fine-grained PAT can be entered in the app for a private-repository check; remove it afterwards and confirm the history clears. Check invalid repository and API-limit messages.

The current cloud environment's `api.github.com` egress policy is separate from Vercel. API requests originate in the visitor's browser. Unit tests and mocked browser checks do not establish that live GitHub access works; live API and private-repository validation remain release checks.

Hashed Vite assets use immutable caching; the HTML keeps Vercel's default caching. Security headers disable framing and sensitive device permissions, prevent MIME sniffing, and omit the referrer. Query-based navigation does not require a catch-all rewrite.
