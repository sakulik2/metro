# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chinese-language quiz about the London Underground: 20 questions split across four themed "lines", with a small interactive game after some lines. Vite + React 19 + TypeScript, no test framework — correctness is enforced by data validators instead (see **Validators**).

## Commands

Any package manager works — npm, yarn, pnpm and bun have all been run against these scripts. `package-lock.json` is committed because the transitive dependencies carry ranges (vite asks for `postcss ^8.5.28`, react-dom for `scheduler ^0.28.0`), so without it a fresh clone builds against an untested tree. yarn and bun just ignore it and install anyway; their own lockfiles are gitignored so two locks can't diverge.

Regenerate it from a clean install (`rm -rf node_modules package-lock.json && npm install`), not with `--package-lock-only` — the latter leaves entries without integrity hashes, which locks versions but not contents.

```bash
npm install            # or yarn / pnpm install / bun install
npm run dev            # dev server
npm run build          # tsc -b && vite build
npm run check          # types + all four validators; run this before calling work done
npm run check:lines    # question bank only
npm run check:money    # £sd arithmetic only
npm run check:drawing  # drawing-board data only
npm run check:tiers    # replay difficulty only
```

**Node must be ≥ 22.6.** `check:money` is `node scripts/check-money.ts` and relies on Node executing TypeScript natively; on older Node it fails outright. That is the one hard version constraint — the package manager is free, the runtime is not. There is no lint step.

Nothing in `package.json` pins a package manager (no `packageManager`, no `engines`, no `npm run` calls inside scripts), and the binaries resolve from `node_modules/.bin`, so keep it that way when editing scripts.

To see a change in the app, `npm run dev` and then **jump straight to it with a `/test` route** rather than answering through the earlier lines:

| route | lands on |
|---|---|
| `#/test` | the index of every destination |
| `#/test/3-02` | line 3, stop 2 (same notation as the on-screen stop plate) |
| `#/test/1-x` | the transfer screen after line 1 |
| `#/test/ticket` / `#/test/decimal` | the booking office, 1863 / 1971 |
| `#/test/drawing` | the drawing room |
| `#/test/end` | the network map |
| `#/test/intro` | the opening screen, regardless of whether you have boarded before |

Prefer this over a throwaway entry that mounts a single component. Such a preview lacks the app's ancestor chain, and that has already hidden a real bug: an absolutely-positioned element resolved against the wrong ancestor and flew 697px off-screen, which the standalone preview could not reproduce. **Verify against the real app.**

## Architecture

### The journey is one reducer

`src/state/journey.ts` holds `line`, `stop`, `phase`, `picks`. **Everything else is derived** — scores, per-stop verdicts, the platform-edge button label, which map nodes are filled. Adding a second source of truth for any of that is a bug, not a feature; the stop list and the quiz deliberately read the same `picks`.

`phase` (`src/data/types.ts`) is `'intro' | 'ride' | 'game' | 'transfer' | 'end'`. `'intro'` is the opening screen, shown only until the player first presses 上车 — that press writes `metro:boarded`, a second `localStorage` key kept apart from `metro:cleared` because "has been here" is not any game's progress. `restart` skips it. Walking a line to its last stop goes to `'game'` if that line has one registered, otherwise straight to `'transfer'` (or `'end'` on the last line). Leaving a game resumes that flow.

### The drawing board zooms once, on New York

IRT's first leg is 6.9px at the normal scale, too short to read a direction off the ghost. So `openingFrame()` in `src/game/drawing.ts` zooms in until it is 96px, and after the first leg is drawn the board holds 2s and pulls back to the full sheet — the leg collapses in front of the player, which is the argument. London's first leg is 43px, under no threshold, so it renders exactly as before; that ordering is deliberate. The canvas size never changes, only the centre and pixels-per-cell inside `px()` / `py()`, animated with `requestAnimationFrame` — `viewBox` scales stroke widths, and `<polyline points>` cannot take a CSS transition.

### The drawing board's per-line colour

Each line carries its own `colour` / `colourHover`, applied as an inline `--route` on the section. **It cannot be called `--line`** — `App.tsx` writes that onto `documentElement` as the global line colour, so the name is taken.

`check:drawing` enforces a contrast floor: ≥4.5:1 against the paper (`#E6E9E0`) and ≥3:1 against the printed grid (`#C3CCC0`). That is not ceremony — Lexington green at its real PMS 355 value manages only 2.43:1 against the grid, so a 9px stroke crossing grid lines goes muddy. The IRT therefore uses a darkened `#006B2D`, recorded in the data's `colourNote` as a reasoned choice rather than a sourced 1904 colour, since the line predates the colour system entirely. Its hover *darkens* where London's brightens, because green has no headroom at that lightness; the CSS says so, or someone will "fix" the asymmetry.

### The booking office spans two eras

`BookingOffice` covers 1863 and 1971, so it carries **two palettes switched by `data-era`** on the section. The custom properties are named for their role (`--ground`, `--accent`, `--slip`, `--face`, `--edge`…), not for their material — calling the slot `--wood` made the 1971 values a lie, which is why they were renamed. `CoinFace.css` reads `--accent` and `--on-accent` from that scope, so the coins follow the era too.

1971 is British Rail's 1965 corporate identity: rail blue BS 381C 114, warning yellow BS 381C 356, signal red BS 381C 537, pearl grey for the bodyside band. Rail Alphabet is not bundled — Barlow stands in, which is an honest approximation rather than a pretend one. The double arrow is a geometric approximation in inline SVG; the two diagonals **must stay parallel** (the lower arrow is the upper one rotated 180° about the viewBox centre), because crossing them makes it a different mark.

`newGame(stage?, run?)` and `BookingOffice({ stage })` exist only so `/test/decimal` can reach 1971 without counting change five times.

### Replays change the content, not just the difficulty

`src/state/cleared.ts` is the game-progress persistence (`localStorage`, key `metro:cleared`; the only other key is `metro:boarded`, see above). It holds a per-game clear count, which drives two things:

- **Content** — `runFor(game)` is uncapped. Booking-office passengers have three `variants` each, picked by `variantOf(round, run)`; the drawing board has two `LINE_SETS`, picked by `setOf(run)`. Both cycle when they run out.
- **Difficulty** — `tierOf(count)` caps at 2. Booking: tier 2 drops the "该找" line and the tray's running gap, tier 3 also demands the fewest coins. Drawing: tier 2 drops the bearing readout, tier 3 the geography ghost too.

Both halves are needed. Withholding hints alone makes a replay reward *remembering* the answers rather than working them out, so `check:tiers` requires every amount within a passenger to be distinct **and** no two drawing lines to share a straightened direction sequence. Conversely, new content alone would leave the same scaffolding propping it up.

**The history never varies to make this work.** Fares are verified, so what varies is how many tickets and which coin is handed over. Lines are real lines, so a second one means actually researching one — note that *drawing the same line backwards does not count*: rounding is symmetric under a 180° rotation, so the reversed line has an identical leg ratio, direction count and per-leg `offBy`. It is a mirror, not a puzzle. `ROADMAP.md` records that dead end and the three candidate lines measured and rejected.

The drawing board's second line also carries its own reveal rather than reusing Beck's — same 45° method, opposite verdict (Vignelli 1972, replaced 1979, vindicated 2025). A third line needs a third argument, or it is just new coordinates.

Two traps, both already fallen into, that `check:tiers` now guards:

- **A disabled button is a leak.** `交给乘客` used to disable until the amount was exact, which announced the answer as loudly as the running total. Past tier 1 you may hand over anything; the passenger counts it and pushes it back.
- **A withheld hint must have a way back.** Being stuck is not difficulty. Each game offers a two-step hint the player asks for — direction first, then the figure. One step straight to the answer just gets pressed immediately.

Every read and write of `localStorage` is wrapped in try/catch: it throws outright in private mode. Any failure is treated as a first run, because failing to read progress should cost a difficulty tier, not show a blank screen.

Scripts that import app code need `scripts/resolve-src.ts` and **must use `await import`** — `src/` omits file extensions and imports JSON plainly (Vite's `moduleResolution: bundler`), and static imports all resolve before any module body runs, so the hook would register too late.

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

**`src/game/drawing.json` is generated — never hand-edit it.** Bearings, distances and `offBy` come from station coordinates via `scripts/gen-drawing.mjs`; `check:drawing` recomputes all three and fails on any drift. It holds a `lines` array, one entry per drawable line.

The reveal's `spacing` sentence is **interpolated from `legs` at generation time**, not written by hand. It used to carry three numbers and two station names typed in, with nothing checking them — which would have silently paired London's prose with New York's legs. `check:drawing` keeps a cheap `String.includes` guard against someone hand-editing the JSON, but the real fix is that the figures have no hand-written source any more.

### Colour switches at runtime

`--line` is a CSS custom property that `App.tsx` writes onto `document.documentElement` on every line change, so the badge, map, platform edge and travelled track all recolour together. Components that need a *different* line's colour (the network map, transfer preview, stop list) set `--line` inline on their own subtree.

Beware: `.col` and `.sign-row` / `.edge-row` sit on the same element and are both single-class selectors. `.col` therefore must not use the `padding` shorthand — it would silently zero the other's vertical padding. This already caused a bug; the comment in `tokens.css` says so.

## Validators

These exist because each one caught a real bug. They are the closest thing this repo has to tests.

- **`check:lines`** — the important one: a stop label must not give away its own answer. The line map shows every label from the moment you board, so labels like "波士顿" / "布达" published the answer before the question was read. Also checks answer indices, duplicate options, colliding line colours, over-long labels.
- **`check:money`** — 36 assertions taken from `predecimal`'s own tests and the text of the Decimal Currency Act 1969. If the money is wrong the booking office has no point.
- **`check:drawing`** — recomputes bearings/distances from coordinates, refuses a self-crossing polyline, and fails if the longest leg is under 1.5× the shortest, since then the level has nothing to reveal.
- **`check:tiers`** — the replay difficulty. Tiers must tighten monotonically, every tier that withholds something must have a two-step hint that can get it back, the second step must yield something actionable, a passenger's sets must ask for different amounts, and no two drawing lines may share a direction sequence. It caught two amount collisions that had passed visual review. It also pins that `restart` preserves the run and the line — dropping either would silently reset the player's progress on one button press. And it pins that the drawing board's opening zoom is centred on the first station, never biased toward the second — a frame that leans the way the first leg goes is a hint, and on tier 3 it would be the only one.

## CI

`.github/workflows/pages.yml` builds `main` to GitHub Pages with npm — npm specifically for CI, even though local work is package-manager-free. The gate is `npm run check` (types + all four validators), which runs before the build.

Two things it gets right on purpose, so don't "simplify" them back:

- **`npm ci`, not `npm install`** — the lockfile is committed, and `ci` installs exactly what it says and fails loudly if `package.json` has drifted out of sync with it.
- **Pages serves from a subpath**, so the base is passed on the command line: `npm run build -- --base=/${{ github.event.repository.name }}/`. It stays out of `vite.config.ts` deliberately — an unset base is correct for local dev and `vite preview`, and hardcoding the repo name there would break both.

Note when testing that build locally in Git Bash: MSYS rewrites a leading-slash argument into a Windows path, so `--base=/metro/` silently becomes `/Program Files/Git/metro/`. Prefix with `MSYS_NO_PATHCONV=1`. The Ubuntu runner is unaffected.

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
