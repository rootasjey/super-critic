# Super Critic

Action platformer with tight combat in small, room-based levels. Short-term focus: movement/combat feel, readable visuals, and authoring workflow. Roadmap includes save progression, character choices, and a skill/attributes system.

— Built with Nuxt 4 + Vue 3 + Phaser 3.

## Quickstart

```fish
# install deps
bun install
# or
npm install

# dev server (http://localhost:3000)
bun run dev
# or
npm run dev

# production build
bun run build && bun run preview
# or
npm run build && npm run preview
```

## Controls & Debug

- Move: arrows or `A`/`D`
- Jump: `Space` (coyote time + jump buffer)
- Drop through one-way: double-tap `Down` or `S`
- Toggle debug: `F2`
- Live collider tune (when debug is on):
  - `J`/`L`: width −/+
  - `I`/`K`: height +/−
  - `U`/`O`: offsetX −/+
  - `N`/`M`: offsetY −/+
  - `P`: print current collider to console

Query params
- `?debug=true` enables debug at boot
- `?skin=bomb`, `?skin=captain`, or `?skin=captain-sword` selects the player skin

## Project Structure

- `app/components`: Vue UI components (e.g. `Game.vue`, `GameDebug.vue`)
- `app/game`: Game code (Player entity + skins)
- `public/assets`: Static assets (sprites, tilesets, tilemaps, sounds)
- `app/stores`: Pinia stores (e.g. debug toggles)
- `tools`: Utility scripts (e.g. auto-tiling helpers, asset rename)

Current entry points
- `app/components/Game.vue`: boots Phaser, hosts `StageScene` and loads Tiled map + objects
- `app/game/Player.ts`: Player controller (movement, jump buffer, coyote, drop-through)
- `app/game/skins/*`: Skin definitions with animation frames and physics body presets
 - Enemy idle animations: preloaded and created in `app/game/systems/objects.ts` via `preloadEnemyIdleFrames()` and `ensureEnemyIdleAnims()`; played on spawn in `placeEnemies()`.

## Suggested Organization Improvements

These don’t change behavior; they make the codebase easier to extend.

- Scenes: move the inline `StageScene` into `app/game/scenes/StageScene.ts`. Optionally add a `BootScene` (preload/asset keys) and `UIScene`.
- Entities: introduce `app/game/entities` with `Player`, `Enemy`, and a small `Actor` base (movement params, hitbox, facing, common animation helpers).
- Systems: split map loading/collision into `app/game/map/tiled.ts` (embed external tilesets, build solids/one-ways), and `app/game/systems/collisions.ts` (collider wiring and one-way process functions).
- Config: centralize tunables in `app/game/config.ts` (physics constants, camera fit, debug flags).
- Assets: consolidate asset key definitions and preloading into a lightweight registry (avoid raw paths scattered across scene code). Example: `assets.register('door_closed', '/assets/sprites/2-Door/1-Closed/1.png')`.
- Debug: keep `GameDebug` UI, but gate per-feature graphics via the store; draw helpers live next to systems (e.g., platforms collider debug in `systems/collisions`).

Adopting this gradually is fine; we can scaffold folders and move `StageScene` first.

## Player Skins

- Modular skins live in `app/game/skins/*` and are selected at runtime via `?skin=...`.
- Visual parity via `desiredDisplayHeight` so skins appear comparable regardless of source frame size.
- Each skin defines a tight Arcade body in source-frame pixels (pre-scale) to ignore transparent margins.

Add a new skin
- Create `app/game/skins/MyNewSkin.ts` exporting `PlayerSkin` with counts/rates, `preload(scene)`, `desiredDisplayHeight`, `origin`, and `body`.
- Wire it in `Game.vue` `getSelectedSkin()`.

## Asset Naming Conventions

Goal: uniform, URL-safe, lowercase kebab-case for paths and files.

- Case: lowercase only
- Word separator: `-` (kebab-case)
- Remove numeric prefixes like `01-` in folder names
- Frame files: `<anim>-<NN>.png` with 2+ digit zero padding (e.g., `idle-01.png`)
- Avoid spaces and mixed separators

Example
`Captain Clown Nose/Captain Clown Nose without Sword/01-Idle/Idle 01.png`
→ `captain-clown-nose/captain-clown-nose-without-sword/idle/idle-01.png`

### Safe Migration Plan

We’ll migrate incrementally to avoid breaking Tiled references and existing code.

1) Start with player sprites only: `public/assets/sprites/player/**`
2) Generate a mapping with a dry-run and review
3) Create kebab-case copies (keep originals) and update code to new paths
4) Once stable, optionally move/remove originals and expand to other folders with the same flow

Tooling
- `tools/rename-assets.mjs` provides dry-run, copy/move/link, include/exclude filters, and a mapping file for revert.

Examples (fish shell)
```fish
# Dry-run (player sprites only, default)
node tools/rename-assets.mjs --dry-run

# Create kebab-case copies next to originals
node tools/rename-assets.mjs --apply --mode copy

# Actually move files (after code updates)
node tools/rename-assets.mjs --apply --mode move

# Limit scope (e.g., only Captain Clown)
node tools/rename-assets.mjs --apply --mode copy --include 'Captain Clown Nose'

# Revert using the last mapping file
node tools/rename-assets.mjs --revert
```

## Notes on Maps & Tilesets

- We currently embed external tilesets at runtime for the `stage-0.json` map. This keeps Tiled exports simple while avoiding additional HTTP requests.
- If we prefer a build-time step, we can add a small tool to pre-embed tilesets and emit a `*-embedded.json` for faster loads and simpler scene code.

## Tech Stack

- Nuxt 4, Vue 3, Pinia
- Phaser 3 (Arcade Physics)
- UnoCSS + @una-ui

## Contributing

- Use concise, descriptive keys for assets; avoid hardcoding raw paths in multiple files.
- Favor small, testable helpers for map/physics.
- When adding assets, follow the kebab-case convention and/or run the rename tool.
