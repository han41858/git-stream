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

Enter `owner/repo` or `https://github.com/owner/repo`. The graph fills the viewport. Its transparent toolbar uses a compact repository field and a search icon. Choose a **Branch**: its first-parent history forms the straight main line, while other histories use side lanes connected by actual parent SHAs. Merged ancestry is not flattened onto the base line; unrelated histories remain separate. `main` is preferred, then `master` if `main` is absent, then the repository default. History starts at the selected branch only. In newest-first mode, visible gaps fetch ancestry from their actual parent SHAs, including merge parents with no surviving branch name. Branch names never decide which histories to fetch. In oldest-first mode, the API’s last-page link finds the oldest history directly, then scrolling down loads preceding API pages toward newer commits under a pinned head SHA. Both modes scroll down in their chosen direction. Actual roots and already loaded joins do not trigger requests. Branch-name pages serve the picker and labels only. Repository activity, including PR merges and merge queues, discovers independent branches such as active release branches, even when they have not merged into the base. Their histories enter only within the selected timeline’s date window, ordered by activity time rather than branch names. Activity pagination follows GitHub’s opaque `after` cursor; it never increments a numeric page or repeats a cursor. Empty date-filtered histories are reconsidered when exploration reaches older dates. In oldest-first mode, current active heads enter after the base traversal reaches the present. Dormant branches with no activity in the API’s last-year window remain available by selecting them explicitly. Loading stops at the history boundary or an API error; use Retry after an error. Loaded history is a partial view of the selected branch and discovered active branches until traversal ends. Dashed edges indicate unloaded parents. Branch-name badges follow the visible first-parent path near its line while scrolling, and disappear when that path leaves the viewport. Merge connectors and visible curve crossings also carry their branch names; nearby badges move apart to avoid covering each other. Already assigned node, branch, and edge colors remain stable when late references or ancestry arrive. Side-branch names stop at a join into another path, while references already sharing the base follow that shared history. Hover a node for a tooltip, or tap/click it for a dismissible detail panel. **Options → Commit details** opens an accessible commit selector. Time direction has a top-bar toggle labeled **↓ Older** or **↓ Newer**, describing the history below; its arrow always points down; theme remains under Options. Loading uses a circular spinner with an active GitHub request count such as `x5`, excluding queued work. Rotation has slow (1–4), medium (5–8), and fast (9+) speeds; reduced-motion mode keeps the count visible without rotation. The Token panel explains repository selection and required permissions before opening GitHub’s token form. Mobile graphs show nodes, edges, and branch names; messages, SHAs, and authors appear in the details only.

The base-branch picker recommends up to 30 currently existing branches. `main`, `master`, and the repository default are pinned first in that order, without duplicates; the rest rank by PRs merged into each branch in the last 90 days. PR counting starts only when the picker opens and processes up to three pages per batch. Partial counts are labeled with `+`; **Continue PR ranking** completes further batches. Deleted branches are excluded. Search filters loaded names; **Find exact branch** can select any branch outside the recommendations.

For private repositories, supply a fine-grained PAT limited to selected repositories with **Contents: Read-only**. PR recommendations additionally require **Pull requests: Read-only**. Applying it saves it in this browser’s localStorage and restores it after refresh. It is sent only to `api.github.com`. Removing it deletes the saved token and clears displayed history. Storage failures are shown in the token panel; no analytics. Public repositories work without a token, normally at 60 REST requests per hour per IP. Authenticated requests normally allow 5,000 per hour. A rate-limit error displays its retry time and pauses retries until then; permission errors are reported separately. PR-ranking failures do not clear the graph. GitHub limits can vary by authentication and secondary limits.

## Architecture and limits

`model.ts` owns data and topological lane layout; `api.ts` owns paginated REST requests; `history.ts` coordinates cancellation, encountered-parent traversal, directional pagination, deduplication, and bounded loading batches; `Graph.tsx` draws viewport nodes and intersecting edges on a DPR-aware canvas. Branch refs and lanes are separate. Commit identity is deduplicated by SHA. Parent relationships, rather than dates, determine order. Parent lanes are reused where possible, with earlier assignments preferred as pages arrive. `graphColors.ts` keeps path colors separate from lane placement: first-parent continuations and incoming merge connectors keep their path color across pagination. `branchLabels.ts` anchors labels to visible curve segments rather than only branch heads.

The canvas bounds its drawing to the viewport, but layout and edge traversal still process loaded history. No claim of unlimited history: 10,000 synthetic commits are covered by automated tests; live large-repository and 100,000-commit performance still need measurement. Unresolved parent boundaries are captured across the entire scroll movement, including intermediate regions skipped during fast scrolling, and retained until resolved. Visited vertical intervals are stored separately for each graph column so horizontal scrolling does not load lanes the user never traversed. These intervals follow commit identities when parallel responses insert or reorder rows, so the base branch's continuation is not lost after layout changes. Late responses are checked against those intervals to continue branches whose new boundaries appear behind the viewport. Up to sixteen commit HTTP requests run concurrently across parent paths and activity-discovered branches. A slow branch never blocks another available slot; loading continues to accept new visible boundaries, and queued work survives scrolling out of view. Identical in-flight commit queries share one request. Accepted boundary work is registered before subscribers run, and cleanup publishes the remaining queue so unresolved cursors are reconsidered without another scroll event. Empty or mismatched boundary responses keep the gap unresolved and expose Retry rather than falsely marking the path complete. Repository, direction, or token changes cancel queued and in-flight work. Fully loaded shared ancestry is not fetched again just because an API source still has additional pages. Branch-name discovery never starts commit requests. Activity discovery scans at most one metadata page and three independent histories per batch, skips already loaded heads, and pauses with a Retry branches control if it fails. Oldest-first uses API pagination metadata to avoid downloading the complete history before rendering; if last-page metadata is unavailable, it reports an error instead of scanning every page. Errors pause new automatic loading while already accepted independent requests can finish; Retry repeats failed sources without refetching successful paths. Infinite scroll is incremental loading, not an unlimited memory or performance guarantee. No offline cache; private history remains visible in memory until cleared or refreshed. GitHub access depends on the browser network policy and API quota.

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

Vercel GitHub bot comments are disabled through the project’s commit/PR comment settings and `github.silent` in `vercel.json`.

Month separators span the viewport with `YYYY.MM` above the line at the right. They attach to the earliest commit near the first of each month in both directions. A partial oldest month waits for older context instead of being labeled at the month end.
