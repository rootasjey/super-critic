<!-- GitHub Copilot / AI agent instructions for the Super Critic codebase -->

# Super Critic — Agent Instructions

Purpose: give AI coding agents the precise, actionable knowledge they need to be productive in this repo.

- Project type: Nuxt 4 + Vue 3 SPA hosting Phaser 3 game code under `app/game`.
- Entry points: `app/components/Game.vue` boots Phaser and instantiates `StageScene` (game runtime).
- Key game files:
  - `app/game/Player.ts` — player controller (movement, jump buffer, coyote time, drop-through)
  - `app/game/skins/*` — player skins; each exports a `PlayerSkin` object with `preload(scene)`, `desiredDisplayHeight`, `origin`, and `body` fields
  - `app/game/scenes/StageScene.ts` — scene implementation (note: currently in `app/game/scenes/StageScene.ts` file)
  - `app/game/systems/*` — game systems (camera, lifecycle, objects, player, tileset)

- Runtime commands (from `package.json` / `README.md`):
  - Install: `bun install` (preferred) or `npm install`
  - Dev: `bun run dev` or `npm run dev` (launches Nuxt dev server at `http://localhost:3000`)
  - Build: `bun run build` / `npm run build` then `bun run preview` / `npm run preview`
  - Postinstall hook: `nuxt prepare` runs automatically after install

- Project conventions (important to follow):
  - Assets: public assets live in `public/assets` and use lowercase kebab-case paths.
  - Player skins: selected via query param `?skin=bomb|captain|captain-sword` — `Game.vue` resolves the skin and calls its `preload(scene)`.
  - Debugging: toggle debug overlay with `F2` or `?debug=true` at boot; `GameDebug.vue` and `app/stores/debug.ts` coordinate UI + store state.
  - Tilemaps: Tiled JSON maps live under `public/assets/tilemaps` and sometimes embed tilesets at runtime.

- Code patterns to preserve when editing:
  - Animation frames and body rectangles are defined in skin modules (do not hardcode different body shapes elsewhere).
  - Map & asset keys are referenced as raw paths/strings in several places (changing paths requires updating usage sites or adding an assets registry).

- When adding a new skin: copy the `PlayerSkin` shape used by `app/game/skins/*`, implement `preload(scene)` and `body` in source-frame pixels, and wire `getSelectedSkin()` in `app/components/Game.vue` if adding new names.

- Common tasks and helpful files:
  - Asset rename tooling: `tools/rename-assets.mjs` (dry-run, copy, move, revert) — use for bulk kebab-case migrations.
  - Tileset and map helpers: `tools/tileset-inspector.html` and `tools/autotile-platforms.mjs`.
  - Dev UI: `app/components/GameDebug.vue` shows runtime debug controls and live collider tuning keys (J/L/I/K/U/O/N/M/P).

- Tests & CI: none discoverable in repo — avoid adding tests that require heavy infra without confirming a test runner. Prefer local `bun`/`npm` dev workflow.

- Integration points & third-party packages to be aware of:
  - `phaser` (v3) — game loop, arcade physics; many game modules call Phaser APIs directly.
  - `nuxt` (v4) — server + build tooling; routes and runtime config follow Nuxt conventions.
  - `pinia` — global stores (see `app/stores/debug.ts`).

- Safety and non-goals for agents:
  - Do not rename or move public asset files without updating `tools/rename-assets.mjs` mapping and verifying Tiled map references.
  - Avoid large refactors of scene boot order without running the dev server locally; subtle path and preload ordering breaks are easy to introduce.

Don't hesitate to propose alternative when assignments seem too constrained or if you see a better way to implement something.
Prefer saying that you need more context or a different approach rather than making risky assumptions.
If anything below is unclear or you need more detailed examples (e.g., a specific skin file or the exact place debug store is read), ask and I will iterate.
