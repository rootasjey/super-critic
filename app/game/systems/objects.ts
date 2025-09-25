import Phaser from 'phaser'

export function ensureTinyWhiteTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('empty')) return

  const tex = scene.textures.createCanvas('empty', 1, 1) as Phaser.Textures.CanvasTexture
  const ctx = tex.getContext()
  if (ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 1, 1)
  }
  tex.refresh()
}

export function buildCollisionSolids(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap, raw: any) {
  const solids = scene.physics.add.staticGroup()
  ensureTinyWhiteTexture(scene)

  const collisionLayerData: any = (raw.layers || []).find((layer: any) => layer.name === 'collision' && layer.type === 'tilelayer')
  if (collisionLayerData && Array.isArray(collisionLayerData.data)) {
    const cw = map.tileWidth
    const ch = map.tileHeight
    const width = collisionLayerData.width
    const height = collisionLayerData.height

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tileIndex = collisionLayerData.data[y * width + x]
        if (!tileIndex) continue

        const cx = x * cw + cw / 2
        const cy = y * ch + ch / 2
        const tile = solids.create(cx, cy, 'empty') as Phaser.Physics.Arcade.Sprite
        tile.setDisplaySize(cw, ch)
        tile.refreshBody()
        tile.setVisible(false)
      }
    }
  }

  return solids
}

export function buildOneWayPlatforms(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap) {
  const platforms = scene.physics.add.staticGroup()
  ensureTinyWhiteTexture(scene)

  const layer = map.getObjectLayer('platform-collision')
  if (layer?.objects) {
    layer.objects.forEach((obj: any) => {
      const ox = obj.x ?? 0
      const oy = obj.y ?? 0
      const width = obj.width ?? map.tileWidth
      const height = obj.height ?? map.tileHeight

      const cx = ox + width / 2
      const cy = oy - height / 2
      const platform = platforms.create(cx, cy, 'empty') as Phaser.Physics.Arcade.Sprite
      platform.setDisplaySize(width, height)
      platform.refreshBody()
      platform.setVisible(false)
    })
  }

  return platforms
}

export function placeDecorations(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap) {
  const layer = map.getObjectLayer('Decoration')
  if (!layer?.objects) return

  const keyMap: Record<string, string> = {
    door: 'door_closed',
    barrel: 'barrel',
    barrel_top: 'barrel',
    table: 'table',
    bottle1: 'bottle_blue',
    bottle2: 'bottle_red',
    skull: 'skull',
    windowA: 'window_light_1',
    windowB: 'window_light_2',
    candle1: 'candle_1',
    chain1: 'small_chain',
    chain2: 'small_chain',
    chain3: 'small_chain',
    chain_big: 'big_chain',
    heartUI: 'heart',
  }

  layer.objects.forEach((obj: any) => {
    const key = keyMap[obj?.name] || keyMap[obj?.type]
    if (!key) return

    const placed = scene.add.image(obj.x, obj.y, key)
    placed.setOrigin(0, 0)

    if (key.includes('window')) {
      placed.setBlendMode(Phaser.BlendModes.MULTIPLY)
    }

    if (obj.type === 'ui' || obj.name === 'heartUI' || obj.name === 'heart') {
      placed.setScrollFactor(0)
      placed.setScale(0.9)
      placed.setOrigin(0, 0)
    }
  })
}
