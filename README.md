# Goreview

A category-aware pull request review UI. Instead of dumping you into a raw diff, Goreview groups changed files by what they touch, shows before/after content side by side, and surfaces structured change summaries in plain language.

## Goal

Make PR review faster to scan and easier to reason about — especially when a change spans database, backend, UI, packages, and docs in one branch.

## What it does

- **Category-grouped file tree** — files bucketed as `database`, `ui`, `backend`, `package`, `config`, `test`, `ci`, `docs`, or `unknown`
- **Before / after comparison** — full file contents for the selected path (not line-level hunks yet)
- **Structured explanations** — events like symbol added/removed, signature changed, or dependency added/updated rendered as readable bullets
- **PR metadata** — title, repo, branches, and short base/head SHAs fetched from your actual github data

## Stack

| Layer           | Choice                           |
| --------------- | -------------------------------- |
| UI              | React 19 + TypeScript            |
| Build           | Vite 8                           |
| Styling         | Tailwind CSS v4                  |
| Components      | shadcn/ui (Radix) + Lucide icons |
| Validation      | Zod 4                            |
| Package manager | pnpm                             |

## Data model

Defined in `src/schemas/review.ts`:

```
ReviewSnapshot
  ├── metadata (title, repo, branches, SHAs)
  └── files[]
        ├── path, status, old/new content
        ├── categories[]
        └── events[]  (symbol / signature / dependency changes)
```

Anything that later analyzes a PR should emit JSON matching this schema; the UI already consumes it.

## GitHub integration

The demo can load a real pull request when env vars are set. Copy [`.env.example`](.env.example) to `.env.local`:

```bash
cp .env.example .env.local
```

```env
VITE_GITHUB_TOKEN=ghp_...
VITE_GITHUB_OWNER=octocat
VITE_GITHUB_REPO=Hello-World
VITE_GITHUB_PR=1347
```

Or pass query params: `?owner=octocat&repo=Hello-World&pr=1347` (token still comes from env).

Without token + PR coordinates, the app falls back to the fixture snapshot.

**Security:** a PAT in `VITE_*` is exposed to the browser. Fine for local demos; production apps should call `fromPullRequest` from a backend and pass the snapshot to the UI.

### Library API

```ts
import { fromPullRequest } from "./core/github/from-pull-request";

const { snapshot, ensureFile } = await fromPullRequest({
	owner: "octocat",
	repo: "Hello-World",
	number: 1347,
	token: process.env.GITHUB_TOKEN,
});

// snapshot.files are classified + analyzed (eager for ≤40 files)
// large PRs lazy-load via ensureFile(path)
```

Pipeline:

1. Octokit fetches PR meta + file list + base/head contents
2. `classifyFile` assigns categories from path rules
3. `analyzeFile` emits events from `package.json` and TypeScript (`ts-morph`)
4. `explainEvents` turns events into readable copy in the UI

## How to Install

```bash
# npm
npm install goreview

# pnpm
pnpm add goreview

# yarn
yarn add goreview
```

Peer dependencies you’ll typically already have in a React app:

```bash
npm install react react-dom
# or
pnpm add react react-dom
# or
yarn add react react-dom
```

### Try without installing

```bash
# npm
npx goreview

# pnpm
pnpm dlx goreview

# yarn
yarn dlx goreview
```

That will launch the demo review UI against sample data (once the CLI entry is wired).

### Local development (this repo)

Working on the prototype itself:

```bash
pnpm install
pnpm dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

| Script         | Purpose                      |
| -------------- | ---------------------------- |
| `pnpm dev`     | Dev server with HMR          |
| `pnpm build`   | Typecheck + production build |
| `pnpm preview` | Serve the production build   |
| `pnpm lint`    | ESLint                       |

## Roadmap (high level)

- Diff-aware or syntax-highlighted code panes
- npm publish + CLI entry
- OAuth / GitHub App auth (replace browser PAT)
- More domain analyzers (Prisma, React hooks)
