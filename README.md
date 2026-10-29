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

Enter `owner/repo` or `https://github.com/owner/repo`. The graph fills the viewport. Choose a **Base branch**: its first-parent history forms the straight main line, while other histories use side lanes connected by actual parent SHAs. Merged ancestry is not flattened onto the base line; unrelated histories remain separate. `main` is preferred, then `master` if `main` is absent, then the repository default. The chosen branch loads first, up to 100 commits per page, followed by a small batch of other branches. A visible unfinished branch loads its own next page when an unloaded-parent boundary comes into view, even if other branches extend much farther. Actual roots and already loaded joins do not trigger requests. Scroll toward older history to load more commits and branch references automatically (down in newest-first mode, up in oldest-first mode). Loading stops at the history boundary or an API error; use Retry after an error. Loaded history is always a partial subset until every source ends. Dashed edges indicate unloaded parents. Branch-name badges follow the visible first-parent path near its line while scrolling, and disappear when that path leaves the viewport. Merge connectors and visible curve crossings also carry their branch names; nearby badges move apart to avoid covering each other. Side-branch names stop at a join into another path, while references already sharing the base follow that shared history. Hover a node for a tooltip, or tap/click it for a dismissible detail panel. **Options → Commit details** opens an accessible commit selector. Time direction has a top-bar toggle labeled **↓ Older** or **↓ Newer**, describing the history below; its arrow always points down; theme remains under Options. Loading uses a spinner, with no scroll-direction hint. The Token panel explains repository selection and required permissions before opening GitHub’s token form. Mobile graphs show nodes, edges, and branch names; messages, SHAs, and authors appear in the details only.

The base-branch picker recommends up to 30 currently existing branches. `main`, `master`, and the repository default are pinned first in that order, without duplicates; the rest rank by PRs merged into each branch in the last 90 days. PR counting starts only when the picker opens and processes up to three pages per batch. Partial counts are labeled with `+`; **Continue PR ranking** completes further batches. Deleted branches are excluded. Search filters loaded names; **Find exact branch** can select any branch outside the recommendations.

For private repositories, supply a fine-grained PAT limited to selected repositories with **Contents: Read-only**. PR recommendations additionally require **Pull requests: Read-only**. It is held only in React memory, sent only to `api.github.com`, and cleared on reload. Removing it also clears displayed history. No persistent token storage or analytics. Public repositories work without a token, normally at 60 REST requests per hour per IP. Authenticated requests normally allow 5,000 per hour. A rate-limit error displays its retry time and pauses retries until then; permission errors are reported separately. PR-ranking failures do not clear the graph. GitHub limits can vary by authentication and secondary limits.

## Architecture and limits

`model.ts` owns data and topological lane layout; `api.ts` owns paginated REST requests; `history.ts` coordinates cancellation, per-branch pagination, deduplication, and bounded loading batches; `Graph.tsx` draws viewport nodes and intersecting edges on a DPR-aware canvas. Branch refs and lanes are separate. Commit identity is deduplicated by SHA. Parent relationships, rather than dates, determine order. Parent lanes are reused where possible, with earlier assignments preferred as pages arrive. `graphColors.ts` keeps path colors separate from lane placement: first-parent continuations and incoming merge connectors keep their path color across pagination. `branchLabels.ts` anchors labels to visible curve segments rather than only branch heads.

The canvas bounds its drawing to the viewport, but layout and edge traversal still process loaded history. No claim of unlimited history: 10,000 synthetic commits are covered by automated tests; live large-repository and 100,000-commit performance still need measurement. Each continuation batch requests up to four sources whose unresolved parent boundaries are visible. Fully loaded shared ancestry is not fetched again just because an API source still has additional pages. Discovering more branch names and previously unseen heads is separate, in batches of up to three new histories. Errors pause automatic loading. Infinite scroll is incremental loading, not an unlimited memory or performance guarantee. No offline cache; private history remains visible in memory until cleared or refreshed. GitHub access depends on the browser network policy and API quota.

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
