import Phaser from 'phaser'

export type EnemyKey = 'enemy1' | 'enemy2' | 'enemy3'

type AnimSpec = { folder: string; frames: number; frameRate: number }
type EnemyAnimSet = { idle: AnimSpec; run: AnimSpec; attack: AnimSpec; hit?: AnimSpec }
type EnemyBodyConfig = { widthFactor: number; heightFactor: number; bottomPad: number }

const ENEMY_ANIMS: Record<EnemyKey, EnemyAnimSet> = {
  enemy1: {
    idle: { folder: '/assets/sprites/enemies/enemy-bald-pirate/idle', frames: 34, frameRate: 12 },
    run: { folder: '/assets/sprites/enemies/enemy-bald-pirate/run', frames: 14, frameRate: 14 },
    attack: { folder: '/assets/sprites/enemies/enemy-bald-pirate/attack', frames: 12, frameRate: 10 },
    hit: { folder: '/assets/sprites/enemies/enemy-bald-pirate/hit', frames: 8, frameRate: 14 },
  },
  enemy2: {
    idle: { folder: '/assets/sprites/enemies/enemy-cucumber/idle', frames: 36, frameRate: 12 },
    run: { folder: '/assets/sprites/enemies/enemy-cucumber/run', frames: 12, frameRate: 14 },
    attack: { folder: '/assets/sprites/enemies/enemy-cucumber/attack', frames: 11, frameRate: 10 },
    hit: { folder: '/assets/sprites/enemies/enemy-cucumber/hit', frames: 8, frameRate: 14 },
  },
  enemy3: {
    idle: { folder: '/assets/sprites/enemies/enemy-big-guy/idle', frames: 38, frameRate: 10 },
    run: { folder: '/assets/sprites/enemies/enemy-big-guy/run', frames: 16, frameRate: 12 },
    attack: { folder: '/assets/sprites/enemies/enemy-big-guy/attack', frames: 11, frameRate: 8 },
    hit: { folder: '/assets/sprites/enemies/enemy-big-guy/hit', frames: 8, frameRate: 12 },
  },
}

// Stable, bottom-centered body configs per enemy type (tunable)
const ENEMY_BODY: Record<EnemyKey, EnemyBodyConfig> = {
  enemy1: { widthFactor: 0.40, heightFactor: 0.90, bottomPad: 2 },
  enemy2: { widthFactor: 0.36, heightFactor: 0.82, bottomPad: 2 },
  enemy3: { widthFactor: 0.46, heightFactor: 0.74, bottomPad: 2 },
}

function syncEnemyBody(sprite: Phaser.Physics.Arcade.Sprite, cfg: EnemyBodyConfig) {
  const body = sprite.body as Phaser.Physics.Arcade.Body | null
  if (!body) return
  // Use display size so body matches on-screen pixels even if scaled or frames vary
  const fw = Math.max(1, sprite.displayWidth || sprite.width || 0)
  const fh = Math.max(1, sprite.displayHeight || sprite.height || 0)
  if (!fw || !fh) return
  const bw = Math.max(1, Math.round(fw * cfg.widthFactor))
  const bh = Math.max(1, Math.round(fh * cfg.heightFactor))
  const offX = Math.round((fw - bw) / 2)
  const offY = Math.round(fh - bh - cfg.bottomPad)
  body.setSize(bw, bh, false)
  body.setOffset(offX, offY)
}

export function preloadEnemyIdleFrames(scene: Phaser.Scene) {
  for (const [k, set] of Object.entries(ENEMY_ANIMS) as Array<[EnemyKey, EnemyAnimSet]>) {
    const spec = set.idle
    for (let i = 1; i <= spec.frames; i++) {
      const key = `${k}_idle_${i}`
      const ii = String(i).padStart(2, '0')
      const parts = spec.folder.split('/')
      const base = parts[parts.length - 1]
      const url = `${spec.folder}/${base}-${ii}.png`
      if (!scene.textures.exists(key)) scene.load.image(key, url)
    }
  }
}

export function preloadEnemyRunAttackFrames(scene: Phaser.Scene) {
  for (const [k, set] of Object.entries(ENEMY_ANIMS) as Array<[EnemyKey, EnemyAnimSet]>) {
    const toLoad: Array<{ prefix: string; spec: AnimSpec }> = [
      { prefix: 'run', spec: set.run },
      { prefix: 'attack', spec: set.attack },
      ...(set.hit ? [{ prefix: 'hit', spec: set.hit }] : []),
    ]
    for (const { prefix, spec } of toLoad) {
      for (let i = 1; i <= spec.frames; i++) {
        const key = `${k}_${prefix}_${i}`
        const ii = String(i).padStart(2, '0')
        const parts = spec.folder.split('/')
        const base = parts[parts.length - 1]
        const url = `${spec.folder}/${base}-${ii}.png`
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
    const hitKey = `enemy:${k}:hit`
    if (set.hit && !scene.anims.exists(hitKey)) {
      const f = set.hit
      const frames = Array.from({ length: f.frames }, (_, idx) => ({ key: `${k}_hit_${idx + 1}` }))
      scene.anims.create({ key: hitKey, frames, frameRate: f.frameRate, repeat: 0 })
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
  verticalAggro: number
  attackRange: number
  cooldown: number
  restTimer: number
  restMin: number
  restMax: number
  // whether this enemy is allowed to walk off ledges/platforms
  canFallOff?: boolean
  // after encountering a ledge while chasing, ignore player for a bit
  avoidLedgeTimer?: number
  // stagger timer after taking a hit; while > 0, AI paused
  hurtTimer?: number
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
    verticalAggro: 72,
    attackRange: 50,
    cooldown: 0,
    restTimer: 0,
    restMin: 0.8,
    restMax: 1.8,
    canFallOff: false,
    avoidLedgeTimer: 0,
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

// Returns true if there is any static body (solid or one-way) below the probe rect
function hasGroundBelow(scene: Phaser.Scene, rx: number, ry: number, rw = 3, rh = 6): boolean {
  const probe = new Phaser.Geom.Rectangle(rx - rw / 2, ry, rw, rh)
  let hit = false
  // iterate all static bodies (includes solids and one-way platforms built in this project)
  scene.physics.world.staticBodies.iterate((b: Phaser.Physics.Arcade.StaticBody) => {
    if (hit || !b || !b.enable) return true
    const rect = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height)
    if (Phaser.Geom.Intersects.RectangleToRectangle(probe, rect)) {
      hit = true
      return false
    }
    return true
  })
  return hit
}

// Determine if there is a ledge ahead in the current facing direction
function isLedgeAhead(scene: Phaser.Scene, body: Phaser.Physics.Arcade.Body, facing: 1 | -1): boolean {
  // position the probe slightly ahead of the feet and just below current bottom
  const aheadX = body.center.x + facing * (body.width / 2 + 3)
  const probeY = body.bottom + 1
  const groundThere = hasGroundBelow(scene, aheadX, probeY)
  return !groundThere
}

export function updateEnemyAI(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite, player?: Phaser.Physics.Arcade.Sprite) {
  const d = getEnemyData(sprite)
  if (!d) return
  const body = sprite.body as Phaser.Physics.Arcade.Body
  const dt = scene.game.loop.delta / 1000
  if (d.cooldown > 0) d.cooldown = Math.max(0, d.cooldown - dt)
  if (d.restTimer > 0) d.restTimer = Math.max(0, d.restTimer - dt)
  if (d.avoidLedgeTimer && d.avoidLedgeTimer > 0) d.avoidLedgeTimer = Math.max(0, (d.avoidLedgeTimer || 0) - dt)

  // While hurt, let knockback play out and don't override anim/state
  if (d.hurtTimer && d.hurtTimer > 0) {
    d.hurtTimer = Math.max(0, d.hurtTimer - dt)
    sprite.setFlipX(d.facing < 0)
    return
  }

  // simple facing flip on world bounds or blocked walls
  if (body.blocked.left) d.facing = 1
  else if (body.blocked.right) d.facing = -1

  // basic aggro by distance (suppressed while avoiding ledge)
  let targetX: number | null = null
  if (player && (d.avoidLedgeTimer || 0) === 0) {
    const dx = player.x - sprite.x
    const dy = player.y - sprite.y
    const withinVertical = Math.abs(dy) <= d.verticalAggro
    const dist = Math.hypot(dx, dy)
    if (withinVertical && dist <= d.aggroRange) targetX = player.x
  }

  // choose behavior
  const ledgeAhead = !d.canFallOff && body.onFloor() && isLedgeAhead(scene, body, d.facing)

  if (targetX !== null) {
    const dx = targetX - sprite.x
    // only update facing to target if not blocked by ledge
    if (!ledgeAhead) d.facing = dx >= 0 ? 1 : -1
    const absdx = Math.abs(dx)
    if (ledgeAhead) {
      // stop before ledge when chasing, then flip and avoid re-chasing for a beat
      body.setVelocityX(0)
      playEnemyAnim(d, 'idle')
      sprite.setFlipX(d.facing < 0)
      if (d.restTimer === 0) {
        d.restTimer = d.restMin + Math.random() * (d.restMax - d.restMin)
        d.facing = d.facing === 1 ? -1 : 1
        d.avoidLedgeTimer = 1.2
      }
    } else if (absdx <= d.attackRange && d.cooldown === 0) {
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
    if ((d.facing < 0 && nearLeftEdge) || (d.facing > 0 && nearRightEdge) || hitWall || ledgeAhead) {
      body.setVelocityX(0)
      playEnemyAnim(d, 'idle')
      sprite.setFlipX(d.facing < 0)
      // queue rest and flip
      d.restTimer = d.restMin + Math.random() * (d.restMax - d.restMin)
      d.facing = (d.facing === 1 ? -1 : 1)
      if (ledgeAhead) {
        // move slightly away from the edge and avoid immediate re-evaluation
        sprite.setX(sprite.x + (d.facing * 2))
        d.avoidLedgeTimer = Math.max(d.avoidLedgeTimer || 0, 0.5)
      }
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
    function resolveEnemyKey(obj: any): EnemyKey {
      const name = (obj?.name || '').toLowerCase()
      if (name === 'enemy1' || name === 'enemy2' || name === 'enemy3') return name as EnemyKey
      // default to enemy1 if misconfigured
      return 'enemy1'
    }

    enemiesLayer.objects.forEach((obj: any) => {
      const ox = obj.x || 0
      const oy = (obj.y || 0) - (obj.height || 0)
      const key = resolveEnemyKey(obj)
      const enemy = enemiesGroup.create(ox, oy, key) as Phaser.Physics.Arcade.Sprite
      enemy.setCollideWorldBounds(true)
      enemy.setBounce(0.05)
      const body = enemy.body as Phaser.Physics.Arcade.Body
      body.setMaxVelocity(200, 1000)
      body.setDrag(200, 0)
      const data = attachEnemyData(enemy, key as EnemyKey)
      
      // Optional Tiled properties: canFallOff (bool), aggroRange (number), verticalAggro (number)
      try {
        const props = Array.isArray(obj.properties) ? obj.properties : []
        const toKey = (s: string) => (s || '').toLowerCase().replace(/[_\-]/g, '')
        const findProp = (...names: string[]) => {
          const set = names.map(toKey)
          return props.find((p: any) => set.includes(toKey(p?.name || '')))
        }
        const numVal = (p: any): number | undefined => {
          if (!p) return undefined
          const v = p.value
          if (typeof v === 'number') return v
          if (typeof v === 'string') { const f = parseFloat(v); return Number.isFinite(f) ? f : undefined }
          return undefined
        }
        const boolVal = (p: any): boolean | undefined => {
          if (!p) return undefined
          const v = p.value
          if (typeof v === 'boolean') return v
          if (typeof v === 'string') return v.toLowerCase() === 'true'
          return undefined
        }

        const pFall = findProp('canFallOff', 'can_fall_off', 'can-fall-off', 'canfalloff')
        const pAggro = findProp('aggroRange', 'aggro_range', 'aggro-range', 'aggrorange')
        const pVert = findProp('verticalAggro', 'vertical_aggro', 'vertical-aggro', 'verticalaggro', 'aggroVertical')
        const pPatrolRange = findProp('patrolRange', 'patrol_range', 'patrol-range', 'patrolrange')
        const pPatrolSpeed = findProp('patrolSpeed', 'patrol_speed', 'patrol-speed', 'patrolspeed')

        const b = boolVal(pFall); if (typeof b === 'boolean') data.canFallOff = b
        const a = numVal(pAggro); if (typeof a === 'number') data.aggroRange = a
        const v = numVal(pVert); if (typeof v === 'number') data.verticalAggro = v
        const pr = numVal(pPatrolRange); if (typeof pr === 'number') data.patrolRange = pr
        const ps = numVal(pPatrolSpeed); if (typeof ps === 'number') data.patrolSpeed = ps
      } catch {}
      const animKey = `enemy:${key}:idle`
      if (scene.anims.exists(animKey)) enemy.anims.play(animKey, true)
      // Keep enemy body stable across frames and flips
      const cfg = ENEMY_BODY[key]
      if (cfg) {
        // Recompute when animation frames update (frame size can change)
        enemy.on(Phaser.Animations.Events.ANIMATION_UPDATE, () => syncEnemyBody(enemy, cfg))
        // Initial sync (after first frame applied by play)
        // If anim not yet started, defer one tick
        scene.time.delayedCall(0, () => syncEnemyBody(enemy, cfg))
      }
      enemy.setDepth(1)
    })
    scene.physics.add.collider(enemiesGroup, solids)
  }
  return enemiesGroup
}

export type Knockback = { x: number; y: number }

export function applyEnemyHit(scene: Phaser.Scene, enemy: Phaser.Physics.Arcade.Sprite, knock: Knockback, dir: 1 | -1, stagger = 0.3) {
  const data = getEnemyData(enemy)
  const body = enemy.body as Phaser.Physics.Arcade.Body | null
  if (!body) return
  // visual feedback
  try {
    enemy.setTintFill(0xff4444)
    scene.time.delayedCall(80, () => enemy.clearTint())
  } catch {}
  // play hit anim if available
  const key: EnemyKey | undefined = (data?.key || undefined) as any
  if (key) {
    const hitAnimKey = `enemy:${key}:hit`
    if (scene.anims.exists(hitAnimKey)) {
      try { enemy.anims.play(hitAnimKey, true) } catch {}
    }
  }
  // apply knockback
  try {
    body.setVelocityX((knock.x || 0) * dir)
    if (typeof knock.y === 'number') body.setVelocityY(knock.y)
  } catch {}
  // mark hurt to suspend AI briefly
  if (data) {
    data.hurtTimer = Math.max(stagger, 0)
    // small cooldown to avoid immediate attack after hurt
    data.cooldown = Math.max(data.cooldown, 0.5)
  }
}

export function placeDecorations(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap) {
  const decoLayer = map.getObjectLayer('Decoration')
  if (decoLayer && decoLayer.objects) {
    decoLayer.objects.forEach((obj: any) => {
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
      let key: string | null = keyMap[obj?.name] || keyMap[obj?.type] || null
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
