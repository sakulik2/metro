# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chinese-language quiz about the London Underground: 20 questions split across four themed "lines", with a small interactive game after some lines. Vite + React 19 + TypeScript, no test framework — correctness is enforced by data validators instead (see **Validators**).

## Commands

Any package manager works — npm, yarn, pnpm and bun have all been run against these scripts. No lockfile is committed, and all of them are gitignored, so install with whichever you have and don't add one back.

```bash
npm install            # or yarn / pnpm install / bun install
npm run dev            # dev server
npm run build          # tsc -b && vite build
npm run check          # types + all three validators; run this before calling work done
npm run check:lines    # question bank only
npm run check:money    # £sd arithmetic only
npm run check:drawing  # drawing-board data only
```

**Node must be ≥ 22.6.** `check:money` is `node scripts/check-money.ts` and relies on Node executing TypeScript natively; on older Node it fails outright. That is the one hard version constraint — the package manager is free, the runtime is not. There is no lint step.

Nothing in `package.json` pins a package manager (no `packageManager`, no `engines`, no `npm run` calls inside scripts), and the binaries resolve from `node_modules/.bin`, so keep it that way when editing scripts.

To see a change in the app, `npm run dev` and drive it in a browser. Reaching a late game means answering through the earlier lines, so for visual work on one component it is usually faster to write a throwaway entry that mounts just that component, screenshot it, then delete the entry and restore `vite.config.ts`.

## Architecture

### The journey is one reducer

`src/state/journey.ts` holds `line`, `stop`, `phase`, `picks`. **Everything else is derived** — scores, per-stop verdicts, the platform-edge button label, which map nodes are filled. Adding a second source of truth for any of that is a bug, not a feature; the stop list and the quiz deliberately read the same `picks`.

`phase` (`src/data/types.ts`) is `'ride' | 'game' | 'transfer' | 'end'`. Walking a line to its last stop goes to `'game'` if that line has one registered, otherwise straight to `'transfer'` (or `'end'` on the last line). Leaving a game resumes that flow.

### Games hang off a registry

`GAMES` in `src/data/lines.ts` maps a line index to a game id:

```ts
export const GAMES: Record<number, string> = {
  0: 'booking',   // 1863 booking office, £sd change
  2: 'drawing',   // 1931 Beck's drawing board, 45° straightening
};
```

Adding a game means: data JSON + rules module in `src/game/`, component in `src/components/`, an entry here, a branch in `App.tsx`, a label in `nextLabel()`, and a validator script. `ROADMAP.md` has the plan for the two unbuilt ones and the reasoning about which knowledge is worth a game at all.

### Data is loaded, validated, and throws loudly

Question banks live one JSON per line in `src/data/lines/`, wired into `RAW` in `src/data/lines.ts`. The loader validates every entry at import time and throws naming the offending line and stop, rather than rendering a broken station. Same for `src/game/booking.ts`, which additionally refuses a round whose fare cannot be paid or whose change cannot be made from the coin set.

**`src/game/drawing.json` is generated — never hand-edit it.** Bearings and distances come from station coordinates via `scripts/gen-drawing.mjs`; `check:drawing` recomputes them and fails on any drift.

### Colour switches at runtime

`--line` is a CSS custom property that `App.tsx` writes onto `document.documentElement` on every line change, so the badge, map, platform edge and travelled track all recolour together. Components that need a *different* line's colour (the network map, transfer preview, stop list) set `--line` inline on their own subtree.

Beware: `.col` and `.sign-row` / `.edge-row` sit on the same element and are both single-class selectors. `.col` therefore must not use the `padding` shorthand — it would silently zero the other's vertical padding. This already caused a bug; the comment in `tokens.css` says so.

## Validators

These exist because each one caught a real bug. They are the closest thing this repo has to tests.

- **`check:lines`** — the important one: a stop label must not give away its own answer. The line map shows every label from the moment you board, so labels like "波士顿" / "布达" published the answer before the question was read. Also checks answer indices, duplicate options, colliding line colours, over-long labels.
- **`check:money`** — 36 assertions taken from `predecimal`'s own tests and the text of the Decimal Currency Act 1969. If the money is wrong the booking office has no point.
- **`check:drawing`** — recomputes bearings/distances from coordinates, refuses a self-crossing polyline, and fails if the longest leg is under 1.5× the shortest, since then the level has nothing to reveal.

## CI (decided, not built)

When CI happens it will be **GitHub Actions building to GitHub Pages, using npm** — npm specifically for CI, even though local work is package-manager-free. No workflow file exists yet; don't add one until asked.

Two things that will bite whoever writes it:

- **`npm ci` will fail** — there is no committed lockfile (see Commands). Use `npm install`.
- **Pages serves from a subpath**, so `vite.config.ts` needs `base: '/<repo>/'` or every asset 404s. It is currently unset, which is correct for local dev and wrong for Pages.

`npm run check` is the gate worth running in CI: it covers types and all three validators.

## Conventions

**Commits in English, Conventional Commits form** (`feat(money):`, `fix:`, `docs:`…). Code comments and UI copy are Chinese. Commit in logical batches, not one lump.

**Historical claims get verified before they go in the data**, with the source noted. Avoid facts that expire ("world's longest") unless dated and sourced.

**Each game gets its own visual material** — the quiz is modern station signage (cool grey, flat), the booking office is gaslit wood and brass, the drawing board is draughtsman's graph paper. Spend boldness in one place per screen and keep the rest quiet. Sizes that carry an argument must stay true: coins are drawn at real relative diameter because that *is* the point of that level, so equal-width slots would destroy it.

**`--control` / `--control-text` in `tokens.css`** keep header and footer controls at one height and size, distinguished by fill rather than by scale.

## The single-file ancestor

The project began as one 1281-line HTML file that opened on double-click. That is the root commit `36257c6`, kept on the **`legacy`** branch at the path it actually had, and `main` descends from it — same `index.html` path, single file became the Vite entry.

```bash
git show legacy:index.html > /tmp/metro-single.html
```

The `legacy/` working-tree copy is a convenience and is gitignored.
