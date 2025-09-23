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
    npc1: '/assets/sprites/2-Enemy-Bald Pirate/1-Idle/1.png',
    npc2: '/assets/sprites/3-Enemy-Cucumber/1-Idle/1.png',
    npc3: '/assets/sprites/4-Enemy-Big Guy/1-Idle/1.png',

    // UI + decorations
    heart: '/assets/sprites/11-Health Bar/Heart.png',
    door_closed: '/assets/sprites/2-Door/1-Closed/1.png',
    barrel: '/assets/sprites/12-Other Objects/Barrel.png',
    table: '/assets/sprites/12-Other Objects/Table.png',
    bottle_blue: '/assets/sprites/12-Other Objects/Blue Bottle.png',
    bottle_red: '/assets/sprites/12-Other Objects/Red Bottle.png',
    skull: '/assets/sprites/12-Other Objects/Skull.png',
    window_light_1: '/assets/sprites/8-Window Light/1.png',
    window_light_2: '/assets/sprites/8-Window Light/2.png',
    small_chain: '/assets/sprites/9-Small Chain/5.png',
    big_chain: '/assets/sprites/10-Big Chain/5.png',
    candle_1: '/assets/sprites/6-Candle/1.png',
    chair: '/assets/sprites/12-Other Objects/Chair.png',
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
