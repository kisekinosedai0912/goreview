# Goreview

A category-aware pull request review UI. Instead of dumping you into a raw diff, Goreview groups changed files by what they touch, shows before/after content side by side, and surfaces structured change summaries in plain language.

## Goal

Make PR review faster to scan and easier to reason about — especially when a change spans database, backend, UI, packages, and docs in one branch.

The long-term intent is a review surface fed by real PR analysis. Today this repo is the **frontend prototype**: the data contract, layout, and interaction model for that experience.

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

- Wire real PR / git data into `ReviewSnapshot`
- Diff-aware or syntax-highlighted code panes
- Infer categories and events from analysis instead of fixtures
