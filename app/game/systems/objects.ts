import Phaser from 'phaser'
import type { Player } from '~/game/Player'

export type EnemyKey = 'enemy1' | 'enemy2' | 'enemy3'

type AnimSpec = { folder: string; frames: number; frameRate: number }
type EnemyAnimSet = { idle: AnimSpec; run: AnimSpec; attacks: Record<string, AnimSpec>; hit?: AnimSpec }
type EnemyBodyConfig = { widthFactor: number; heightFactor: number; bottomPad: number }

type EnemyAttackRange = { min?: number; max: number; vertical?: number }
type EnemyMeleeHitbox = {
  widthFactor: number
  heightFactor: number
  forwardFactor: number
  verticalOffsetFactor?: number
}
type EnemyKnockback = { x: number; y?: number }

type EnemyAttackDefinition = {
  key: string
  animation: string
  range: EnemyAttackRange
  windup: number
  recover: number
  cooldown: number
  damage: number
  hitbox: EnemyMeleeHitbox
  knockback?: EnemyKnockback
  debugColor?: number
}

type EnemyDefaults = {
  patrolSpeed: number
  patrolRange: number
  aggroRange: number
  verticalAggro: number
  restMin: number
  restMax: number
  canFallOff?: boolean
}

type EnemyDefinition = {
  key: EnemyKey
  anims: EnemyAnimSet
  body: EnemyBodyConfig
  attacks: EnemyAttackDefinition[]
  defaults?: Partial<EnemyDefaults>
}

const BASE_DEFAULTS: EnemyDefaults = {
  patrolSpeed: 60,
  patrolRange: 120,
  aggroRange: 130,
  verticalAggro: 72,
  restMin: 0.8,
  restMax: 1.8,
  canFallOff: false,
}

const ENEMY_DEFS: Record<EnemyKey, EnemyDefinition> = {
  enemy1: {
    key: 'enemy1',
    anims: {
      idle: { folder: '/assets/sprites/enemies/enemy-bald-pirate/idle', frames: 34, frameRate: 12 },
      run: { folder: '/assets/sprites/enemies/enemy-bald-pirate/run', frames: 14, frameRate: 14 },
      attacks: {
        slash: { folder: '/assets/sprites/enemies/enemy-bald-pirate/attack', frames: 12, frameRate: 10 },
      },
      hit: { folder: '/assets/sprites/enemies/enemy-bald-pirate/hit', frames: 8, frameRate: 14 },
    },
    body: { widthFactor: 0.4, heightFactor: 0.9, bottomPad: 2 },
    attacks: [
      {
        key: 'slash',
        animation: 'slash',
        range: { max: 56, vertical: 50 },
        windup: 0.32,
        recover: 0.45,
        cooldown: 1.15,
        damage: 1,
        hitbox: { widthFactor: 0.82, heightFactor: 0.8, forwardFactor: 0.72, verticalOffsetFactor: -0.08 },
        knockback: { x: 160, y: -90 },
        debugColor: 0xff8833,
      },
    ],
    defaults: {
      aggroRange: 140,
      verticalAggro: 68,
      patrolSpeed: 65,
    },
  },
  enemy2: {
    key: 'enemy2',
    anims: {
      idle: { folder: '/assets/sprites/enemies/enemy-cucumber/idle', frames: 36, frameRate: 12 },
      run: { folder: '/assets/sprites/enemies/enemy-cucumber/run', frames: 12, frameRate: 14 },
      attacks: {
        slash: { folder: '/assets/sprites/enemies/enemy-cucumber/attack', frames: 11, frameRate: 11 },
        gust: { folder: '/assets/sprites/enemies/enemy-cucumber/blow-the-wick', frames: 11, frameRate: 10 },
      },
      hit: { folder: '/assets/sprites/enemies/enemy-cucumber/hit', frames: 8, frameRate: 14 },
    },
    body: { widthFactor: 0.36, heightFactor: 0.82, bottomPad: 2 },
    attacks: [
      {
        key: 'slash',
        animation: 'slash',
        range: { max: 52, vertical: 52 },
        windup: 0.28,
        recover: 0.42,
        cooldown: 1.05,
        damage: 1,
        hitbox: { widthFactor: 0.78, heightFactor: 0.75, forwardFactor: 0.7, verticalOffsetFactor: -0.05 },
        knockback: { x: 140, y: -80 },
        debugColor: 0x33aaff,
      },
      {
        key: 'gust',
        animation: 'gust',
        range: { min: 70, max: 170, vertical: 60 },
        windup: 0.5,
        recover: 0.6,
        cooldown: 2.2,
        damage: 1,
        hitbox: { widthFactor: 1.6, heightFactor: 0.7, forwardFactor: 1.25, verticalOffsetFactor: -0.12 },
        knockback: { x: 220, y: -40 },
        debugColor: 0x55ffcc,
      },
    ],
    defaults: {
      aggroRange: 180,
      verticalAggro: 72,
      patrolSpeed: 70,
      restMin: 0.9,
      restMax: 1.9,
    },
  },
  enemy3: {
    key: 'enemy3',
    anims: {
      idle: { folder: '/assets/sprites/enemies/enemy-big-guy/idle', frames: 38, frameRate: 10 },
      run: { folder: '/assets/sprites/enemies/enemy-big-guy/run', frames: 16, frameRate: 12 },
      attacks: {
        slam: { folder: '/assets/sprites/enemies/enemy-big-guy/attack', frames: 11, frameRate: 8 },
      },
      hit: { folder: '/assets/sprites/enemies/enemy-big-guy/hit', frames: 8, frameRate: 12 },
    },
    body: { widthFactor: 0.46, heightFactor: 0.74, bottomPad: 2 },
    attacks: [
      {
        key: 'slam',
        animation: 'slam',
        range: { max: 66, vertical: 54 },
        windup: 0.42,
        recover: 0.7,
        cooldown: 1.6,
        damage: 2,
        hitbox: { widthFactor: 0.95, heightFactor: 0.88, forwardFactor: 0.62, verticalOffsetFactor: -0.05 },
        knockback: { x: 260, y: -140 },
        debugColor: 0xff3355,
      },
    ],
    defaults: {
      patrolSpeed: 52,
      aggroRange: 165,
      verticalAggro: 78,
      restMin: 1.0,
      restMax: 2.1,
    },
  },
}

function enemyEntries(): Array<[EnemyKey, EnemyDefinition]> {
  return Object.entries(ENEMY_DEFS) as Array<[EnemyKey, EnemyDefinition]>
}

function folderBaseName(path: string) {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
  const idx = trimmed.lastIndexOf('/')
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed
}

function frameKey(enemyKey: EnemyKey, animKey: string, frameIndex: number) {
  return `${enemyKey}_${animKey}_${frameIndex}`
}

function animKey(enemyKey: EnemyKey, anim: string) {
  return `enemy:${enemyKey}:${anim}`
}

function preloadAnimFrames(scene: Phaser.Scene, enemyKey: EnemyKey, animName: string, spec: AnimSpec) {
  const base = folderBaseName(spec.folder)
  for (let i = 1; i <= spec.frames; i++) {
    const key = frameKey(enemyKey, animName, i)
    if (scene.textures.exists(key)) continue
    const ii = String(i).padStart(2, '0')
    const url = `${spec.folder}/${base}-${ii}.png`
    scene.load.image(key, url)
  }
}

function ensureAnimation(scene: Phaser.Scene, enemyKey: EnemyKey, animName: string, spec: AnimSpec, repeat: number, alias?: string) {
  const key = animKey(enemyKey, alias ?? animName)
  if (scene.anims.exists(key)) return
  const frames = Array.from({ length: spec.frames }, (_, idx) => ({ key: frameKey(enemyKey, animName, idx + 1) }))
  scene.anims.create({ key, frames, frameRate: spec.frameRate, repeat })
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
  for (const [key, def] of enemyEntries()) {
    preloadAnimFrames(scene, key, 'idle', def.anims.idle)
  }
}

export function preloadEnemyRunAttackFrames(scene: Phaser.Scene) {
  for (const [key, def] of enemyEntries()) {
    preloadAnimFrames(scene, key, 'run', def.anims.run)
    if (def.anims.hit) preloadAnimFrames(scene, key, 'hit', def.anims.hit)
    for (const [attackKey, spec] of Object.entries(def.anims.attacks)) {
      preloadAnimFrames(scene, key, `attack_${attackKey}`, spec)
    }
  }
}

export function ensureEnemyIdleAnims(scene: Phaser.Scene) {
  for (const [key, def] of enemyEntries()) {
    ensureAnimation(scene, key, 'idle', def.anims.idle, -1)
  }
}

export function ensureEnemyRunAttackAnims(scene: Phaser.Scene) {
  for (const [key, def] of enemyEntries()) {
    ensureAnimation(scene, key, 'run', def.anims.run, -1)
    if (def.anims.hit) ensureAnimation(scene, key, 'hit', def.anims.hit, 0)
    for (const [attackKey, spec] of Object.entries(def.anims.attacks)) {
      ensureAnimation(scene, key, `attack_${attackKey}`, spec, 0, `attack:${attackKey}`)
    }
  }
}

type EnemyState = 'idle' | 'run' | 'attack'

type EnemyActiveAttack = {
  def: EnemyAttackDefinition
  phase: 'windup' | 'recover'
  timer: number
  hasHit: boolean
}

type EnemyDebugHitbox = {
  rect: Phaser.Geom.Rectangle
  expires: number
  color: number
}

type EnemyData = {
  sprite: Phaser.Physics.Arcade.Sprite
  key: EnemyKey
  definition: EnemyDefinition
  state: EnemyState
  facing: 1 | -1
  patrolSpeed: number
  patrolRange: number
  baseX: number
  aggroRange: number
  verticalAggro: number
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
  attacks: EnemyAttackDefinition[]
  attackCooldowns: Record<string, number>
  currentAttack?: EnemyActiveAttack
  debugHitbox?: EnemyDebugHitbox
}

function buildDefaultConfig(def: EnemyDefinition) {
  const defaults = def.defaults || {}
  return {
    patrolSpeed: defaults.patrolSpeed ?? BASE_DEFAULTS.patrolSpeed,
    patrolRange: defaults.patrolRange ?? BASE_DEFAULTS.patrolRange,
    aggroRange: defaults.aggroRange ?? BASE_DEFAULTS.aggroRange,
    verticalAggro: defaults.verticalAggro ?? BASE_DEFAULTS.verticalAggro,
    restMin: defaults.restMin ?? BASE_DEFAULTS.restMin,
    restMax: defaults.restMax ?? BASE_DEFAULTS.restMax,
    canFallOff: defaults.canFallOff ?? BASE_DEFAULTS.canFallOff,
  }
}

export function attachEnemyData(sprite: Phaser.Physics.Arcade.Sprite, key: EnemyKey): EnemyData {
  const definition = ENEMY_DEFS[key]
  const { patrolSpeed, patrolRange, aggroRange, verticalAggro, restMin, restMax, canFallOff } = buildDefaultConfig(definition)
  const attackCooldowns: Record<string, number> = {}
  definition.attacks.forEach(att => { attackCooldowns[att.key] = 0 })

  const data: EnemyData = {
    sprite,
    key,
    definition,
    state: 'idle',
    facing: Math.random() > 0.5 ? 1 : -1,
    patrolSpeed,
    patrolRange,
    baseX: sprite.x,
    aggroRange,
    verticalAggro,
    cooldown: 0,
    restTimer: 0,
    restMin,
    restMax,
    canFallOff,
    avoidLedgeTimer: 0,
    attacks: definition.attacks,
    attackCooldowns,
  }
  ;(sprite as any).__enemy = data
  return data
}

export function getEnemyData(sprite: Phaser.Physics.Arcade.Sprite): EnemyData | undefined {
  return (sprite as any).__enemy as EnemyData | undefined
}

function playEnemyBaseAnim(data: EnemyData, state: 'idle' | 'run') {
  const key = animKey(data.key, state)
  if (data.sprite.anims.currentAnim?.key !== key) {
    data.sprite.anims.play(key, true)
  }
  data.state = state
}

function playEnemyAttackAnim(data: EnemyData, attackKey: string) {
  const key = animKey(data.key, `attack:${attackKey}`)
  if (data.sprite.anims.currentAnim?.key !== key) {
    data.sprite.anims.play(key, true)
  }
  data.state = 'attack'
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

function reduceTimers(map: Record<string, number> | undefined, dt: number) {
  if (!map) return
  const keys = Object.keys(map)
  for (const key of keys) {
    const current = map[key] ?? 0
    map[key] = Math.max(0, current - dt)
  }
}

function selectEnemyAttack(data: EnemyData, horizontal: number, vertical: number) {
  const candidate = data.attacks
    .filter(att => (data.attackCooldowns[att.key] || 0) <= 0)
    .filter(att => {
      const min = att.range.min ?? 0
      const max = att.range.max
      const v = att.range.vertical ?? Number.POSITIVE_INFINITY
      return horizontal >= min && horizontal <= max && vertical <= v
    })
    .sort((a, b) => (a.range.max || 0) - (b.range.max || 0))
  return candidate[0]
}

function startEnemyAttack(data: EnemyData, attack: EnemyAttackDefinition) {
  const windup = Math.max(0, attack.windup)
  data.currentAttack = {
    def: attack,
    phase: windup > 0 ? 'windup' : 'recover',
    timer: windup > 0 ? windup : Math.max(0, attack.recover),
    hasHit: false,
  }
  data.attackCooldowns[attack.key] = attack.cooldown
  data.cooldown = Math.max(data.cooldown, 0.25)
  playEnemyAttackAnim(data, attack.animation)
  data.sprite.setVelocityX(0)
}

function performMeleeAttack(scene: Phaser.Scene, data: EnemyData, attack: EnemyAttackDefinition, player?: Player) {
  const body = data.sprite.body as Phaser.Physics.Arcade.Body
  if (!body) return
  const width = Math.max(4, body.width * attack.hitbox.widthFactor)
  const height = Math.max(4, body.height * attack.hitbox.heightFactor)
  const centerX = body.center?.x ?? (body.x + body.width / 2)
  const centerY = body.center?.y ?? (body.y + body.height / 2)
  const hitX = centerX + data.facing * (body.width * attack.hitbox.forwardFactor)
  const hitY = centerY + (attack.hitbox.verticalOffsetFactor ?? 0) * body.height
  const rect = new Phaser.Geom.Rectangle(hitX - width / 2, hitY - height / 2, width, height)

  data.debugHitbox = { rect, expires: scene.time.now + 160, color: attack.debugColor ?? 0xff4444 }

  if (!player || !player.sprite) return
  const playerBody = player.sprite.body as Phaser.Physics.Arcade.Body
  if (!playerBody) return
  const playerRect = new Phaser.Geom.Rectangle(playerBody.x, playerBody.y, playerBody.width, playerBody.height)
  if (Phaser.Geom.Intersects.RectangleToRectangle(rect, playerRect)) {
    player.damage(attack.damage)
    if (attack.knockback) {
      player.sprite.setVelocityX(attack.knockback.x * data.facing)
      if (typeof attack.knockback.y === 'number') player.sprite.setVelocityY(attack.knockback.y)
    }
  }
}

export function updateEnemyAI(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite, player?: Player) {
  const d = getEnemyData(sprite)
  if (!d) return
  const body = sprite.body as Phaser.Physics.Arcade.Body
  if (!body) return
  const dt = scene.game.loop.delta / 1000

  d.cooldown = Math.max(0, d.cooldown - dt)
  d.restTimer = Math.max(0, d.restTimer - dt)
  if (d.avoidLedgeTimer) d.avoidLedgeTimer = Math.max(0, (d.avoidLedgeTimer || 0) - dt)
  if (d.hurtTimer) d.hurtTimer = Math.max(0, d.hurtTimer - dt)
  reduceTimers(d.attackCooldowns, dt)

  // Cancel current attack if hurt
  if (d.hurtTimer && d.hurtTimer > 0) {
    if (d.currentAttack) {
      d.currentAttack = undefined
      playEnemyBaseAnim(d, 'idle')
    }
    sprite.setFlipX(d.facing < 0)
    return
  }

  if (d.currentAttack) {
    const current = d.currentAttack
    sprite.setFlipX(d.facing < 0)
    body.setVelocityX(0)
    current.timer -= dt
    if (current.phase === 'windup' && current.timer <= 0) {
      performMeleeAttack(scene, d, current.def, player)
      current.phase = 'recover'
      current.timer = Math.max(0, current.def.recover)
    } else if (current.phase === 'recover' && current.timer <= 0) {
      d.currentAttack = undefined
      d.cooldown = Math.max(d.cooldown, 0.2)
      playEnemyBaseAnim(d, 'idle')
    }
    return
  }

  // simple facing flip on world bounds or blocked walls
  if (body.blocked.left) d.facing = 1
  else if (body.blocked.right) d.facing = -1

  const playerSprite = player?.sprite
  let targetX: number | null = null
  if (playerSprite && (d.avoidLedgeTimer || 0) === 0) {
    const playerBody = playerSprite.body as Phaser.Physics.Arcade.Body
    const bodyCenter = body.center ?? new Phaser.Math.Vector2(body.x + body.width / 2, body.y + body.height / 2)
    const targetCenter = playerBody?.center ?? new Phaser.Math.Vector2(playerSprite.x, playerSprite.y)
    const dx = targetCenter.x - bodyCenter.x
    const dy = targetCenter.y - bodyCenter.y
    const withinVertical = Math.abs(dy) <= d.verticalAggro
    const dist = Math.hypot(dx, dy)
    if (withinVertical && dist <= d.aggroRange) targetX = targetCenter.x
  }

  const ledgeAhead = !d.canFallOff && body.onFloor() && isLedgeAhead(scene, body, d.facing)

  if (targetX !== null && playerSprite) {
    const playerBody = playerSprite.body as Phaser.Physics.Arcade.Body
    const bodyCenter = body.center ?? new Phaser.Math.Vector2(body.x + body.width / 2, body.y + body.height / 2)
    const targetCenter = playerBody?.center ?? new Phaser.Math.Vector2(playerSprite.x, playerSprite.y)
    const dx = targetCenter.x - bodyCenter.x
    const dy = targetCenter.y - bodyCenter.y
    if (!ledgeAhead) d.facing = dx >= 0 ? 1 : -1
    const absdx = Math.abs(dx)
    const absdy = Math.abs(dy)
    sprite.setFlipX(d.facing < 0)

    if (ledgeAhead) {
      body.setVelocityX(0)
      playEnemyBaseAnim(d, 'idle')
      if (d.restTimer === 0) {
        d.restTimer = d.restMin + Math.random() * (d.restMax - d.restMin)
        d.facing = d.facing === 1 ? -1 : 1
        d.avoidLedgeTimer = 1.2
      }
      return
    }

    if (d.cooldown <= 0) {
      const attack = selectEnemyAttack(d, absdx, absdy)
      if (attack) {
        startEnemyAttack(d, attack)
        sprite.setFlipX(d.facing < 0)
        return
      }
    }

    // chase towards player when no attack is available
    body.setVelocityX(d.facing * Math.min(120, absdx))
    playEnemyBaseAnim(d, 'run')
  } else {
    const left = d.baseX - d.patrolRange
    const right = d.baseX + d.patrolRange

    if (d.restTimer > 0) {
      body.setVelocityX(0)
      playEnemyBaseAnim(d, 'idle')
      sprite.setFlipX(d.facing < 0)
      return
    }

    const nearLeftEdge = sprite.x <= left + 2
    const nearRightEdge = sprite.x >= right - 2
    const hitWall = body.blocked.left || body.blocked.right
    if ((d.facing < 0 && nearLeftEdge) || (d.facing > 0 && nearRightEdge) || hitWall || ledgeAhead) {
      body.setVelocityX(0)
      playEnemyBaseAnim(d, 'idle')
      sprite.setFlipX(d.facing < 0)
      d.restTimer = d.restMin + Math.random() * (d.restMax - d.restMin)
      d.facing = d.facing === 1 ? -1 : 1
      if (ledgeAhead) {
        sprite.setX(sprite.x + (d.facing * 2))
        d.avoidLedgeTimer = Math.max(d.avoidLedgeTimer || 0, 0.5)
      }
      return
    }

    body.setVelocityX(d.facing * d.patrolSpeed)
    playEnemyBaseAnim(d, 'run')
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
      const idleKey = animKey(key, 'idle')
      if (scene.anims.exists(idleKey)) enemy.anims.play(idleKey, true)
      // Keep enemy body stable across frames and flips
      const cfg = data.definition.body
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
