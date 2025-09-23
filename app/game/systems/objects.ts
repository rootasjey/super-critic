import Phaser from 'phaser'

export type EnemyKey = 'npc1' | 'npc2' | 'npc3'

type AnimSpec = { folder: string; frames: number; frameRate: number }
type EnemyAnimSet = { idle: AnimSpec; run: AnimSpec; attack: AnimSpec }

const ENEMY_ANIMS: Record<EnemyKey, EnemyAnimSet> = {
  npc1: {
    idle: { folder: '/assets/sprites/2-Enemy-Bald Pirate/1-Idle', frames: 34, frameRate: 12 },
    run: { folder: '/assets/sprites/2-Enemy-Bald Pirate/2-Run', frames: 14, frameRate: 14 },
    attack: { folder: '/assets/sprites/2-Enemy-Bald Pirate/7-Attack', frames: 12, frameRate: 10 },
  },
  npc2: {
    idle: { folder: '/assets/sprites/3-Enemy-Cucumber/1-Idle', frames: 36, frameRate: 12 },
    run: { folder: '/assets/sprites/3-Enemy-Cucumber/2-Run', frames: 12, frameRate: 14 },
    attack: { folder: '/assets/sprites/3-Enemy-Cucumber/7-Attack', frames: 11, frameRate: 10 },
  },
  npc3: {
    idle: { folder: '/assets/sprites/4-Enemy-Big Guy/1-Idle', frames: 38, frameRate: 10 },
    run: { folder: '/assets/sprites/4-Enemy-Big Guy/2-Run', frames: 16, frameRate: 12 },
    attack: { folder: '/assets/sprites/4-Enemy-Big Guy/7-Attack', frames: 11, frameRate: 8 },
  },
}

export function preloadEnemyIdleFrames(scene: Phaser.Scene) {
  for (const [k, set] of Object.entries(ENEMY_ANIMS) as Array<[EnemyKey, EnemyAnimSet]>) {
    const spec = set.idle
    for (let i = 1; i <= spec.frames; i++) {
      const key = `${k}_idle_${i}`
      const url = `${spec.folder}/${i}.png`
      if (!scene.textures.exists(key)) scene.load.image(key, url)
    }
  }
}

export function preloadEnemyRunAttackFrames(scene: Phaser.Scene) {
  for (const [k, set] of Object.entries(ENEMY_ANIMS) as Array<[EnemyKey, EnemyAnimSet]>) {
    const toLoad: Array<{ prefix: string; spec: AnimSpec }> = [
      { prefix: 'run', spec: set.run },
      { prefix: 'attack', spec: set.attack },
    ]
    for (const { prefix, spec } of toLoad) {
      for (let i = 1; i <= spec.frames; i++) {
        const key = `${k}_${prefix}_${i}`
        const url = `${spec.folder}/${i}.png`
        if (!scene.textures.exists(key)) scene.load.image(key, url)
      }
    }
  }
}

export function ensureEnemyIdleAnims(scene: Phaser.Scene) {
  for (const [k, set] of Object.entries(ENEMY_ANIMS) as Array<[EnemyKey, EnemyAnimSet]>) {
    const animKey = `enemy:${k}:idle`
    if (!scene.anims.exists(animKey)) {
      const f = set.idle
      const frames = Array.from({ length: f.frames }, (_, idx) => ({ key: `${k}_idle_${idx + 1}` }))
      scene.anims.create({ key: animKey, frames, frameRate: f.frameRate, repeat: -1 })
    }
  }
}

export function ensureEnemyRunAttackAnims(scene: Phaser.Scene) {
  for (const [k, set] of Object.entries(ENEMY_ANIMS) as Array<[EnemyKey, EnemyAnimSet]>) {
    const runKey = `enemy:${k}:run`
    if (!scene.anims.exists(runKey)) {
      const f = set.run
      const frames = Array.from({ length: f.frames }, (_, idx) => ({ key: `${k}_run_${idx + 1}` }))
      scene.anims.create({ key: runKey, frames, frameRate: f.frameRate, repeat: -1 })
    }
    const atkKey = `enemy:${k}:attack`
    if (!scene.anims.exists(atkKey)) {
      const f = set.attack
      const frames = Array.from({ length: f.frames }, (_, idx) => ({ key: `${k}_attack_${idx + 1}` }))
      scene.anims.create({ key: atkKey, frames, frameRate: f.frameRate, repeat: 0 })
    }
  }
}

type EnemyState = 'idle' | 'run' | 'attack'
type EnemyData = {
  sprite: Phaser.Physics.Arcade.Sprite
  key: EnemyKey
  state: EnemyState
  facing: 1 | -1
  patrolSpeed: number
  patrolRange: number
  baseX: number
  aggroRange: number
  attackRange: number
  cooldown: number
  restTimer: number
  restMin: number
  restMax: number
}

export function attachEnemyData(sprite: Phaser.Physics.Arcade.Sprite, key: EnemyKey): EnemyData {
  const data: EnemyData = {
    sprite,
    key,
    state: 'idle',
    facing: Math.random() > 0.5 ? 1 : -1,
    patrolSpeed: 60,
    patrolRange: 120,
    baseX: sprite.x,
    aggroRange: 120,
    attackRange: 50,
    cooldown: 0,
    restTimer: 0,
    restMin: 0.8,
    restMax: 1.8,
  }
  ;(sprite as any).__enemy = data
  return data
}

export function getEnemyData(sprite: Phaser.Physics.Arcade.Sprite): EnemyData | undefined {
  return (sprite as any).__enemy as EnemyData | undefined
}

function playEnemyAnim(data: EnemyData, state: EnemyState) {
  const animKey = `enemy:${data.key}:${state}`
  if (data.state !== state || data.sprite.anims.currentAnim?.key !== animKey) {
    data.sprite.anims.play(animKey, true)
    data.state = state
  }
}

export function updateEnemyAI(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite, player?: Phaser.Physics.Arcade.Sprite) {
  const d = getEnemyData(sprite)
  if (!d) return
  const body = sprite.body as Phaser.Physics.Arcade.Body
  const dt = scene.game.loop.delta / 1000
  if (d.cooldown > 0) d.cooldown = Math.max(0, d.cooldown - dt)
  if (d.restTimer > 0) d.restTimer = Math.max(0, d.restTimer - dt)

  // simple facing flip on world bounds or blocked walls
  if (body.blocked.left) d.facing = 1
  else if (body.blocked.right) d.facing = -1

  // basic aggro by distance
  let targetX: number | null = null
  if (player) {
    const dx = player.x - sprite.x
    if (Math.abs(dx) <= d.aggroRange) targetX = player.x
  }

  // choose behavior
  if (targetX !== null) {
    const dx = targetX - sprite.x
    d.facing = dx >= 0 ? 1 : -1
    const absdx = Math.abs(dx)
    if (absdx <= d.attackRange && d.cooldown === 0) {
      playEnemyAnim(d, 'attack')
      body.setVelocityX(0)
      sprite.setFlipX(d.facing < 0)
      d.cooldown = 1.0
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        // return to idle after attack completes
        playEnemyAnim(d, 'idle')
      })
    } else {
      // chase
      body.setVelocityX(d.facing * Math.min(120, absdx))
      playEnemyAnim(d, 'run')
      sprite.setFlipX(d.facing < 0)
    }
  } else {
    // patrol around baseX within patrolRange with rest at edges
    const left = d.baseX - d.patrolRange
    const right = d.baseX + d.patrolRange

    // If currently resting, stay idle until timer elapses
    if (d.restTimer > 0) {
      body.setVelocityX(0)
      playEnemyAnim(d, 'idle')
      sprite.setFlipX(d.facing < 0)
      return
    }

    // Edge reached or wall blocked: start rest, then reverse
    const nearLeftEdge = sprite.x <= left + 2
    const nearRightEdge = sprite.x >= right - 2
    const hitWall = body.blocked.left || body.blocked.right
    if ((d.facing < 0 && nearLeftEdge) || (d.facing > 0 && nearRightEdge) || hitWall) {
      body.setVelocityX(0)
      playEnemyAnim(d, 'idle')
      sprite.setFlipX(d.facing < 0)
      // queue rest and flip
      d.restTimer = d.restMin + Math.random() * (d.restMax - d.restMin)
      d.facing = (d.facing === 1 ? -1 : 1)
      return
    }

    // otherwise walk
    body.setVelocityX(d.facing * d.patrolSpeed)
    playEnemyAnim(d, 'run')
    sprite.setFlipX(d.facing < 0)
  }
}

export function ensureTinyWhiteTexture(scene: Phaser.Scene) {
  if (!scene.textures.exists('empty')) {
    const tex = scene.textures.createCanvas('empty', 1, 1) as Phaser.Textures.CanvasTexture
    const ctx = tex.getContext(); if (ctx) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1, 1) }
    tex.refresh()
  }
}

export function buildCollisionSolids(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap, raw: any) {
  const solids = scene.physics.add.staticGroup()
  ensureTinyWhiteTexture(scene)
  const collisionLayerData: any = (raw.layers || []).find((l: any) => l.name === 'collision' && l.type === 'tilelayer')
  if (collisionLayerData && Array.isArray(collisionLayerData.data)) {
    const cw = map.tileWidth
    const ch = map.tileHeight
    const w = collisionLayerData.width
    const h = collisionLayerData.height
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = collisionLayerData.data[y * w + x]
        if (t && t !== 0) {
          const cx = x * cw + cw / 2
          const cy = y * ch + ch / 2
          const tile = solids.create(cx, cy, 'empty') as Phaser.Physics.Arcade.Sprite
          tile.setDisplaySize(cw, ch)
          tile.refreshBody()
          tile.setVisible(false)
        }
      }
    }
  }
  return solids
}

export function buildOneWayPlatforms(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap) {
  const oneWays = scene.physics.add.staticGroup()
  ensureTinyWhiteTexture(scene)
  const oneWayLayer = map.getObjectLayer('platform-collision')
  if (oneWayLayer && oneWayLayer.objects) {
    oneWayLayer.objects.forEach((obj: any) => {
      const ox = obj.x || 0
      const oy = obj.y || 0
      const w = obj.width || map.tileWidth
      const h = obj.height || map.tileHeight
      const cx = ox + w / 2
      const cy = oy - h / 2
      const platform = oneWays.create(cx, cy, 'empty') as Phaser.Physics.Arcade.Sprite
      platform.setDisplaySize(w, h)
      platform.refreshBody()
      platform.setVisible(false)
    })
  }
  return oneWays
}

export function placeEnemies(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap, solids: Phaser.Physics.Arcade.StaticGroup) {
  const enemiesLayer = map.getObjectLayer('ennemies')
  const enemiesGroup = scene.physics.add.group()
  if (enemiesLayer && enemiesLayer.objects) {
    enemiesLayer.objects.forEach((obj: any) => {
      const ox = obj.x || 0
      const oy = (obj.y || 0) - (obj.height || 0)
      const name = (obj.name || '').toLowerCase()
      let key = 'npc1'
      if (name.includes('cucumber')) key = 'npc2'
      else if (name.includes('marine') || name.includes('big')) key = 'npc3'
      const enemy = enemiesGroup.create(ox, oy, key) as Phaser.Physics.Arcade.Sprite
      enemy.setCollideWorldBounds(true)
      enemy.setBounce(0.05)
      const body = enemy.body as Phaser.Physics.Arcade.Body
      body.setMaxVelocity(200, 1000)
      body.setDrag(200, 0)
      const data = attachEnemyData(enemy, key as EnemyKey)
      const animKey = `enemy:${key}:idle`
      if (scene.anims.exists(animKey)) enemy.anims.play(animKey, true)
      enemy.setDepth(1)
    })
    scene.physics.add.collider(enemiesGroup, solids)
  }
  return enemiesGroup
}

export function placeDecorations(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap) {
  const decoLayer = map.getObjectLayer('Decoration')
  if (decoLayer && decoLayer.objects) {
    decoLayer.objects.forEach((obj: any) => {
      let key: string | null = null
      if (obj.image) {
        const img = String(obj.image)
        if (img.includes('2-Door')) key = 'door_closed'
        else if (img.includes('Barrel.png')) key = 'barrel'
        else if (img.includes('Table.png')) key = 'table'
        else if (img.includes('Blue Bottle')) key = 'bottle_blue'
        else if (img.includes('Red Bottle')) key = 'bottle_red'
        else if (img.includes('Skull.png')) key = 'skull'
        else if (img.includes('Window Light')) {
          if (img.indexOf('1.png') !== -1) key = 'window_light_1'
          else key = 'window_light_2'
        } else if (img.includes('6-Candle')) key = 'candle_1'
        else if (img.includes('Chair.png')) key = 'chair'
        else if (img.includes('Heart.png')) key = 'heart'
        else if (img.includes('9-Small Chain')) key = 'small_chain'
        else if (img.includes('10-Big Chain')) key = 'big_chain'
      }
      if (!key) {
        const keyMap: Record<string,string> = {
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
        key = keyMap[obj.name] || null
      }
      if (key) {
        const placed = scene.add.image(obj.x, obj.y, key)
        placed.setOrigin(0, 0)
        if (key.indexOf('window') !== -1 || key.indexOf('window_light') !== -1) {
          placed.setBlendMode(Phaser.BlendModes.MULTIPLY)
        }
        if (obj.type === 'ui' || obj.name === 'heartUI' || obj.name === 'heart') {
          placed.setScrollFactor(0)
          placed.setScale(0.9)
          placed.setOrigin(0, 0)
        }
      }
    })
  }
}
