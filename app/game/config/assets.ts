// Centralized non-player asset registry (images, tilemaps, json tilesets)
// Player skins remain managed by their own preload logic.

export type ImageKey =
  | 'pirate-bomb'
  | 'npc1'
  | 'npc2'
  | 'npc3'
  | 'heart'
  | 'door_closed'
  | 'barrel'
  | 'table'
  | 'bottle_blue'
  | 'bottle_red'
  | 'skull'
  | 'window_light_1'
  | 'window_light_2'
  | 'small_chain'
  | 'big_chain'
  | 'candle_1'
  | 'chair'

export type JsonKey = 'stage0_raw' | 'ts_pirate' | 'ts_bricks' | 'ts_special' | 'ts_characters'

export const ASSETS = {
  images: {
    // tileset
    'pirate-bomb': '/assets/tilesets/pirate-bomb/Tile-Sets (64-64).png',

    // enemies (placeholder static frames for now)
  npc1: '/assets/sprites/enemies/enemy-bald-pirate/idle/idle-01.png',
  npc2: '/assets/sprites/enemies/enemy-cucumber/idle/idle-01.png',
  npc3: '/assets/sprites/enemies/enemy-big-guy/idle/idle-01.png',

    // UI + decorations
  heart: '/assets/sprites/ui/heart/idle/idle-01.png',
  door_closed: '/assets/sprites/props/door/closed/closed-01.png',
  barrel: '/assets/sprites/props/other-objects/other-objects-barrel.png',
  table: '/assets/sprites/props/other-objects/other-objects-table.png',
  bottle_blue: '/assets/sprites/props/other-objects/other-objects-blue-bottle.png',
  bottle_red: '/assets/sprites/props/other-objects/other-objects-red-bottle.png',
  skull: '/assets/sprites/props/other-objects/other-objects-skull.png',
  window_light_1: '/assets/sprites/props/window-light/window-light-01.png',
  window_light_2: '/assets/sprites/props/window-light/window-light-02.png',
  small_chain: '/assets/sprites/props/small-chain/small-chain-05.png',
  big_chain: '/assets/sprites/props/big-chain/big-chain-05.png',
  candle_1: '/assets/sprites/props/candle/candle-01.png',
  chair: '/assets/sprites/props/other-objects/other-objects-chair.png',
  } as Record<ImageKey, string>,

  json: {
    stage0_raw: '/assets/tilemaps/stage-0.json',
    ts_pirate: '/assets/tilemaps/pirate-bomb-tileset.json',
    ts_bricks: '/assets/tilemaps/bricks.json',
    ts_special: '/assets/tilemaps/special.json',
    ts_characters: '/assets/tilemaps/characters.json',
  } as Record<JsonKey, string>,
}

export type AssetImageKeys = keyof typeof ASSETS.images
export type AssetJsonKeys = keyof typeof ASSETS.json
