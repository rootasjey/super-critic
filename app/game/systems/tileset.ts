import Phaser from 'phaser'

/**
 * Embed external tilesets in a Tiled map JSON into the map data object.
 * Mutates and returns the provided `raw` map object.
 */
export function embedTilesets(scene: Phaser.Scene, raw: any) {
  const embed = (src: string | undefined) => {
    if (!src) return null
    const name = (src.split('/').pop() || src).toLowerCase()
    if (name === 'pirate-bomb.json') {
      const data = scene.cache.json.get('ts_pirate')
      if (data) return data
      return {
        columns: 6,
        image: 'pirate-bomb/tile-sets-64x64.png',
        imageheight: 320,
        imagewidth: 384,
        margin: 0,
        name: 'pirate-bomb',
        spacing: 0,
        tilecount: 30,
        tiledversion: '1.11.2',
        tileheight: 64,
        tilewidth: 64,
        type: 'tileset',
        version: '1.10'
      }
    }
    if (name.includes('bricks.json')) return scene.cache.json.get('ts_bricks')
    if (name.includes('special.json')) return scene.cache.json.get('ts_special')
    if (name.includes('characters.json')) return scene.cache.json.get('ts_characters')
    return null
  }

  if (raw && Array.isArray(raw.tilesets)) {
    raw.tilesets.forEach((ts: any) => {
      if (ts.source) {
        const data = embed(ts.source)
        let embedded = data
        if (!embedded && ts.firstgid === 1) embedded = scene.cache.json.get('ts_pirate')
        if (embedded) {
          const firstgid = ts.firstgid
          Object.keys(ts).forEach(k => { if (k !== 'firstgid') delete ts[k] })
          Object.assign(ts, embedded)
          ts.firstgid = firstgid
          if ((ts.name || '').toLowerCase() !== 'pirate-bomb-tileset') ts.name = 'pirate-bomb-tileset'
          delete ts.source
        } else {
          // eslint-disable-next-line no-console
          console.warn('[Tileset Embed] Could not embed external tileset:', ts.source)
        }
      }
    })
  }

  return raw
}
