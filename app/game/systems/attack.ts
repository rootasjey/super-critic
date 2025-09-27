// Attack hit config: controls how many times and how many enemies can be hit per attack
export type AttackHitConfig = {
  maxHitsPerEnemy: number // e.g. 1 for single-hit, >1 for multi-hit
  maxEnemiesPerAttack: number // e.g. 1 for single-target, >1 for multi-target
}

const defaultAttackHitConfig: AttackHitConfig = {
  maxHitsPerEnemy: 1,
  maxEnemiesPerAttack: Infinity,
}
import Phaser from 'phaser'
import type { PlayerSkin } from '~/game/skins/PlayerSkin'
import { ensureTinyWhiteTexture } from '~/game/systems/objects'
import { applyEnemyHit } from '~/game/enemies/ai'
import type { StageScene } from '~/game/scenes/StageScene'

// Tunable melee range factors (relative to player's Arcade body)
type MeleeRange = { widthFactor: number; heightFactor: number; forwardFactor: number; yOffset?: number }
const captainMeleeRange: MeleeRange = {
  widthFactor: 0.9,
  heightFactor: 0.8,
  forwardFactor: 0.55,
  yOffset: 2,
}

export function configureCaptainMeleeRange(overrides: Partial<MeleeRange>) {
  Object.assign(captainMeleeRange, overrides)
}

// Minimal Player-like shape to avoid circular imports
type PlayerLike = {
  scene: Phaser.Scene
  sprite: Phaser.Physics.Arcade.Sprite
  skin: PlayerSkin
  // attack state managed on Player
  armed?: boolean
  armedUntil?: number
}

export interface AttackStrategy {
  preload(scene: Phaser.Scene): void
  ensureAnims(scene: Phaser.Scene): void
  tryStart(player: PlayerLike): boolean
  isPlayingAttack(player: PlayerLike): boolean
  update(player: PlayerLike, dt: number): void
  shouldArmPlayer?(player: PlayerLike): boolean
  debugDraw?(player: PlayerLike, gfx: Phaser.GameObjects.Graphics): void
}

class NoopAttack implements AttackStrategy {
  preload(): void {}
  ensureAnims(): void {}
  tryStart(): boolean { return false }
  isPlayingAttack(): boolean { return false }
  update(): void {}
  shouldArmPlayer(): boolean { return false }
  debugDraw(): void {}
}

const BOMB_MAX_CHARGE_MS = 1200
const BOMB_MIN_THROW_SPEED = 200
const BOMB_MAX_THROW_SPEED = 420
const BOMB_MIN_THROW_UP = 260
const BOMB_MAX_THROW_UP = 420
const BOMB_BASE_COOLDOWN = 320
const BOMB_POST_EXPLOSION_COOLDOWN = 180
const BOMB_FUSE_BASE = 1600
const BOMB_FUSE_MIN = 900
const BOMB_RADIUS_MIN = 88
const BOMB_RADIUS_MAX = 140
const BOMB_DAMAGE_MIN = 12
const BOMB_DAMAGE_MAX = 26

type BombAttackState = {
  cooldownUntil: number
  charging: boolean
  chargeStart: number
  bar?: Phaser.GameObjects.Sprite
  barHideEvent?: Phaser.Time.TimerEvent
  bombs: Set<BombData>
}

type BombData = {
  sprite: Phaser.Physics.Arcade.Sprite
  chargeRatio: number
  fuseEvent?: Phaser.Time.TimerEvent
  colliders: Phaser.Physics.Arcade.Collider[]
  exploded: boolean
}

const BOMB_CHARGE_FRAME_KEYS = Array.from({ length: 11 }, (_ , i) => `bomb_bar_charge_${i + 1}`)
const BOMB_FULL_FRAME_KEYS = Array.from({ length: 3 }, (_ , i) => `bomb_bar_full_${i + 1}`)

class BombThrowAttack implements AttackStrategy {
  private state = new WeakMap<PlayerLike, BombAttackState>()

  shouldArmPlayer(): boolean {
    return false
  }

  preload(scene: Phaser.Scene): void {
    const ensure = (key: string, url: string) => {
      if (!scene.textures.exists(key)) scene.load.image(key, url)
    }
    ensure('bomb_projectile_off', '/assets/sprites/particles/bomb/bomb-off/bomb-off-01.png')
    for (let i = 1; i <= 10; i++) {
      const ii = String(i).padStart(2, '0')
      ensure(`bomb_projectile_on_${i}`, `/assets/sprites/particles/bomb/bomb-on/bomb-on-${ii}.png`)
    }
    for (let i = 1; i <= 9; i++) {
      const ii = String(i).padStart(2, '0')
      ensure(`bomb_projectile_explosion_${i}`, `/assets/sprites/particles/bomb/explotion/explotion-${ii}.png`)
    }
    BOMB_CHARGE_FRAME_KEYS.forEach((key, idx) => {
      const ii = String(idx + 1).padStart(2, '0')
      ensure(key, `/assets/sprites/ui/bomb-bar/charging-bar/charging-bar-${ii}.png`)
    })
    ensure('bomb_bar_close_1', '/assets/sprites/ui/bomb-bar/closing/closing-01.png')
    BOMB_FULL_FRAME_KEYS.forEach((key, idx) => {
      const ii = String(idx + 1).padStart(2, '0')
      ensure(key, `/assets/sprites/ui/bomb-bar/full-(intermitent)/full-(intermitent)-${ii}.png`)
    })
  }

  ensureAnims(scene: Phaser.Scene): void {
    if (!scene.anims.exists('bomb_projectile_fuse')) {
      const frames = Array.from({ length: 10 }, (_ , i) => ({ key: `bomb_projectile_on_${i + 1}` }))
      scene.anims.create({ key: 'bomb_projectile_fuse', frames, frameRate: 18, repeat: -1 })
    }
    if (!scene.anims.exists('bomb_projectile_explosion')) {
      const frames = Array.from({ length: 9 }, (_ , i) => ({ key: `bomb_projectile_explosion_${i + 1}` }))
      scene.anims.create({ key: 'bomb_projectile_explosion', frames, frameRate: 26, repeat: 0 })
    }
    if (!scene.anims.exists('bomb_bar_full_flash')) {
      const frames = BOMB_FULL_FRAME_KEYS.map(key => ({ key }))
      scene.anims.create({ key: 'bomb_bar_full_flash', frames, frameRate: 12, repeat: -1, yoyo: true })
    }
  }

  tryStart(player: PlayerLike): boolean {
    const scene = player.scene
    const now = scene.time.now
    const st = this.getState(player)
    if (st.charging) return false
    if (now < st.cooldownUntil) return false
    this.ensureAnims(scene)
    st.charging = true
    st.chargeStart = now
    this.showChargeBar(player, st)
    return true
  }

  isPlayingAttack(player: PlayerLike): boolean {
    return this.getState(player).charging
  }

  update(player: PlayerLike): void {
    const scene = player.scene
    const st = this.getState(player)
    if (st.charging) {
      const now = scene.time.now
      const elapsed = now - st.chargeStart
      const ratio = Phaser.Math.Clamp(elapsed / BOMB_MAX_CHARGE_MS, 0, 1)
      this.updateChargeBar(player, st, ratio)
      const keyX: Phaser.Input.Keyboard.Key | undefined = (player as any).keyX
      const keyStillDown = keyX?.isDown ?? false
      if (!keyStillDown || ratio >= 0.999) {
        this.launchBomb(player, st, ratio)
      }
    }

    // Reposition charge bar if visible
    if (st.bar?.visible && player.sprite) {
      const sprite = player.sprite
      st.bar.setPosition(sprite.x, sprite.y - sprite.displayHeight * 0.75)
    }

    // Cleanup bombs that might have left the world bounds
    if (st.bombs.size > 0) {
      const bounds = scene.physics.world.bounds
      for (const bomb of Array.from(st.bombs)) {
        if (bomb.exploded) continue
        const s = bomb.sprite
        if (!s.active) {
          this.triggerExplosion(player, bomb)
          continue
        }
        if (s.y > bounds.bottom + 64 || s.x < bounds.x - 64 || s.x > bounds.right + 64) {
          this.triggerExplosion(player, bomb)
        }
      }
    }
  }

  private getState(p: PlayerLike): BombAttackState {
    let s = this.state.get(p)
    if (!s) {
      s = {
        cooldownUntil: 0,
        charging: false,
        chargeStart: 0,
        bombs: new Set(),
      }
      this.state.set(p, s)
    }
    return s
  }

  private showChargeBar(player: PlayerLike, st: BombAttackState) {
    const scene = player.scene
    if (!st.bar) {
      st.bar = scene.add.sprite(player.sprite.x, player.sprite.y, BOMB_CHARGE_FRAME_KEYS[0]!)
      st.bar.setOrigin(0.5, 1)
      st.bar.setDepth((player.sprite.depth ?? 0) + 5)
    }
    if (st.barHideEvent) {
      st.barHideEvent.remove()
      st.barHideEvent = undefined
    }
  st.bar.setTexture(BOMB_CHARGE_FRAME_KEYS[0]!)
  st.bar.setVisible(true)
  st.bar.setActive(true)
  st.bar.anims?.stop()
  }

  private updateChargeBar(player: PlayerLike, st: BombAttackState, ratio: number) {
    const bar = st.bar
    if (!bar) return
    const frameIndex = Math.min(BOMB_CHARGE_FRAME_KEYS.length - 1, Math.floor(ratio * BOMB_CHARGE_FRAME_KEYS.length))
    const desiredKey = BOMB_CHARGE_FRAME_KEYS[frameIndex] ?? BOMB_CHARGE_FRAME_KEYS[BOMB_CHARGE_FRAME_KEYS.length - 1]!
    if (!bar.anims?.isPlaying || bar.anims.currentAnim?.key !== 'bomb_bar_full_flash') {
      if (bar.texture.key !== desiredKey) bar.setTexture(desiredKey)
    }
    if (ratio >= 0.98) {
      if (bar.anims?.currentAnim?.key !== 'bomb_bar_full_flash') {
        bar.play('bomb_bar_full_flash')
      }
    } else if (bar.anims?.isPlaying) {
      bar.anims.stop()
  bar.setTexture(desiredKey)
    }
  }

  private launchBomb(player: PlayerLike, st: BombAttackState, ratio: number) {
    const scene = player.scene
    const sprite = player.sprite
    if (!sprite) return
    st.charging = false
    const now = scene.time.now
    st.cooldownUntil = now + BOMB_BASE_COOLDOWN

    const bar = st.bar
    if (bar) {
      bar.anims?.stop()
      if (ratio >= 0.98) {
        bar.play('bomb_bar_full_flash')
      } else {
        bar.setTexture('bomb_bar_close_1')
      }
      st.barHideEvent = scene.time.delayedCall(200, () => {
        bar.setVisible(false)
        bar.anims?.stop()
        st.barHideEvent = undefined
      })
    }

    const facing = sprite.flipX ? -1 : 1
    const originX = sprite.x + facing * (sprite.displayWidth * 0.35)
    const originY = sprite.y - sprite.displayHeight * 0.2
    const bomb = scene.physics.add.sprite(originX, originY, 'bomb_projectile_on_1')
    bomb.setDepth((sprite.depth ?? 0) + 3)
    bomb.setBounce(0.2)
    bomb.setCollideWorldBounds(true)
    bomb.body.onWorldBounds = true
    bomb.setCircle(Math.max(4, Math.round((bomb.width ?? 16) * 0.45)))
    bomb.play('bomb_projectile_fuse')

    const speed = Phaser.Math.Linear(BOMB_MIN_THROW_SPEED, BOMB_MAX_THROW_SPEED, ratio)
    const up = Phaser.Math.Linear(BOMB_MIN_THROW_UP, BOMB_MAX_THROW_UP, ratio)
    bomb.setVelocity(facing * speed, -up)

    const bombData: BombData = {
      sprite: bomb,
      chargeRatio: ratio,
      colliders: [],
      exploded: false,
    }

    const stage = scene as StageScene
    const solids: Phaser.Physics.Arcade.StaticGroup | undefined = (stage as any).solidsGroup
    if (solids) {
      const collider = scene.physics.add.collider(bomb, solids, () => this.triggerExplosion(player, bombData))
      bombData.colliders.push(collider)
    }
    const enemies: Phaser.Physics.Arcade.Group | undefined = (stage as any).enemiesGroup
    if (enemies) {
      const overlap = scene.physics.add.overlap(bomb, enemies, () => this.triggerExplosion(player, bombData))
      bombData.colliders.push(overlap)
    }

    bombData.fuseEvent = scene.time.delayedCall(
      Phaser.Math.Clamp(Phaser.Math.Linear(BOMB_FUSE_MIN, BOMB_FUSE_BASE, 1 - ratio), BOMB_FUSE_MIN, BOMB_FUSE_BASE),
      () => this.triggerExplosion(player, bombData)
    )

    st.bombs.add(bombData)
  }

  private triggerExplosion(player: PlayerLike, bombData: BombData) {
    if (bombData.exploded) return
    bombData.exploded = true
    const scene = player.scene
    const st = this.getState(player)
    const sprite = bombData.sprite
    const x = sprite.x
    const y = sprite.y

    bombData.colliders.forEach(collider => { try { collider.destroy() } catch {} })
    bombData.colliders.length = 0

    if (bombData.fuseEvent) {
      bombData.fuseEvent.remove()
      bombData.fuseEvent = undefined
    }

    const body = sprite.body as Phaser.Physics.Arcade.Body | null
    if (body) {
      sprite.setVelocity(0, 0)
      body.enable = false
    }
    sprite.setVisible(false)
    sprite.setActive(false)

    const explosion = scene.add.sprite(x, y, 'bomb_projectile_explosion_1')
    explosion.setDepth((sprite.depth ?? 0) + 4)
    explosion.play('bomb_projectile_explosion')
    explosion.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      explosion.destroy()
    })

    this.applyExplosionDamage(scene, x, y, bombData.chargeRatio)

    scene.time.delayedCall(180, () => {
      try { sprite.destroy() } catch {}
    })

    st.bombs.delete(bombData)
    st.cooldownUntil = Math.max(st.cooldownUntil, scene.time.now + BOMB_POST_EXPLOSION_COOLDOWN)
  }

  private applyExplosionDamage(scene: Phaser.Scene, x: number, y: number, ratio: number) {
    const stage = scene as StageScene
    const enemies: Phaser.Physics.Arcade.Group | undefined = (stage as any).enemiesGroup
    if (!enemies) return
    const radius = Phaser.Math.Linear(BOMB_RADIUS_MIN, BOMB_RADIUS_MAX, ratio)
    const damage = Math.round(Phaser.Math.Linear(BOMB_DAMAGE_MIN, BOMB_DAMAGE_MAX, ratio))
    const knockX = Phaser.Math.Linear(220, 340, ratio)
    const knockY = Phaser.Math.Linear(-180, -260, ratio)

    enemies.children.iterate((obj: Phaser.GameObjects.GameObject) => {
      const enemy = obj as Phaser.Physics.Arcade.Sprite
      if (!enemy || !enemy.active || !enemy.body) return true
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y)
      if (dist <= radius) {
        const dir: 1 | -1 = enemy.x >= x ? 1 : -1
        applyEnemyHit(scene, enemy, { x: knockX, y: knockY }, dir, 0.4, damage, {
          critical: ratio >= 0.98,
          critKnockbackMultiplier: 1.35,
        })
      }
      return true
    })
  }
}

// Captain melee: uses sword variant frames under player_sword_* and attack-1
type KnockbackConfig = { x: number; y: number }
const defaultCaptainSwordKnockback: KnockbackConfig = { x: 220, y: -100 }
let captainSwordKnockback: KnockbackConfig = { ...defaultCaptainSwordKnockback }
export function configureCaptainSwordKnockback(overrides: Partial<KnockbackConfig>) {
  captainSwordKnockback = { ...captainSwordKnockback, ...overrides }
}

// Module-level defaults used when a player's state is first created
let defaultCaptainCritChance = 0.75
let defaultCaptainCritMultiplier = 2
let defaultCaptainCritKnockbackMultiplier = 1.2

type CaptainMeleeState = {
  cooldownUntil: number
  hitbox?: Phaser.Physics.Arcade.Sprite
  collider?: Phaser.Physics.Arcade.Collider
  lastAttackAt: number
  swordEffect?: Phaser.GameObjects.Sprite
  comboStep: number // 1, 2, or 3 for ground attacks
  comboWindowUntil: number // Time window to continue ground combo
  airComboStep: number // 1 or 2 for air attacks
  airComboWindowUntil: number // Time window to continue air combo
  pendingDamage: number
  pendingIsCrit: boolean
  // Per-player crit configuration (exposed so different attacks/players can tune these)
  critChance: number
  critMultiplier: number
  critKnockbackMultiplier: number
}

class CaptainMeleeAttack implements AttackStrategy {
  private state = new WeakMap<PlayerLike, CaptainMeleeState>()
  private hitConfig: AttackHitConfig = { ...defaultAttackHitConfig }

  shouldArmPlayer(): boolean {
    return true
  }

  /**
   * Configure attack hit behavior (single/multi-hit, single/multi-target)
   */
  configureHitBehavior(config: Partial<AttackHitConfig>) {
    this.hitConfig = { ...this.hitConfig, ...config }
  }

  private getState(p: PlayerLike): CaptainMeleeState {
    let s = this.state.get(p)
    if (!s) {
      s = {
        cooldownUntil: 0,
        lastAttackAt: 0,
        comboStep: 1,
        comboWindowUntil: 0,
        airComboStep: 1,
        airComboWindowUntil: 0,
        pendingDamage: 1,
        pendingIsCrit: false,
        critChance: defaultCaptainCritChance,
        critMultiplier: defaultCaptainCritMultiplier,
        critKnockbackMultiplier: defaultCaptainCritKnockbackMultiplier,
      }
      this.state.set(p, s)
    }
    return s
  }

  private getDamageFor(type: 'ground' | 'air', comboStep: number) {
    if (type === 'ground') {
      if (comboStep >= 3) return 20
      return 10
    }
    if (comboStep >= 2) return 20
    return 10
  }

  /**
   * Configure critical settings. If `player` is provided, update that player's state. Otherwise
   * update the module defaults used for newly-created player states.
   */
  configureCritical(opts: { chance?: number; multiplier?: number; knockbackMultiplier?: number }, player?: PlayerLike) {
    if (player) {
      const st = this.getState(player)
      if (typeof opts.chance === 'number') st.critChance = Math.max(0, Math.min(1, opts.chance))
      if (typeof opts.multiplier === 'number') st.critMultiplier = Math.max(1, opts.multiplier)
      if (typeof opts.knockbackMultiplier === 'number') st.critKnockbackMultiplier = Math.max(0, opts.knockbackMultiplier)
    } else {
      if (typeof opts.chance === 'number') defaultCaptainCritChance = Math.max(0, Math.min(1, opts.chance))
      if (typeof opts.multiplier === 'number') defaultCaptainCritMultiplier = Math.max(1, opts.multiplier)
      if (typeof opts.knockbackMultiplier === 'number') defaultCaptainCritKnockbackMultiplier = Math.max(0, opts.knockbackMultiplier)
    }
  }

  preload(scene: Phaser.Scene): void {
    // Load sword base motions
    const base = '/assets/sprites/player/captain-clown-nose/captain-clown-nose-with-sword'
    const ensure = (key: string, url: string) => { if (!scene.textures.exists(key)) scene.load.image(key, url) }
    const loadSeries = (prefix: string, folder: string, count: number) => {
      for (let i = 1; i <= count; i++) {
        const ii = String(i).padStart(2, '0')
        ensure(`player_sword_${prefix}_${i}`, `${base}/${folder}/${folder}-${ii}.png`)
      }
    }
    loadSeries('idle', 'idle-sword', 8)
    loadSeries('run', 'run-sword', 6)
    loadSeries('jump', 'jump-sword', 3)
    loadSeries('fall', 'fall-sword', 1)
    loadSeries('land', 'ground-sword', 2)
    // Ground attacks 1, 2, 3
    loadSeries('attack1', 'attack-1', 3)
    loadSeries('attack2', 'attack-2', 3)
    loadSeries('attack3', 'attack-3', 3)
    // Air attacks 1, 2
    loadSeries('air_attack1', 'air-attack-1', 3)
    loadSeries('air_attack2', 'air-attack-2', 3)
    // Sword effects for ground attacks
    const effectsBase = '/assets/sprites/player/captain-clown-nose/sword-effects'
    for (let attack = 1; attack <= 3; attack++) {
      for (let i = 1; i <= 3; i++) {
        const ii = String(i).padStart(2, '0')
        ensure(`sword_effect_attack${attack}_${i}`, `${effectsBase}/attack-${attack}/attack-${attack}-${ii}.png`)
      }
    }
    // Sword effects for air attacks (only 2 frames each)
    for (let attack = 1; attack <= 2; attack++) {
      for (let i = 1; i <= 2; i++) {
        const ii = String(i).padStart(2, '0')
        ensure(`sword_effect_air_attack${attack}_${i}`, `${effectsBase}/air-attack-${attack}/air-attack-${attack}-${ii}.png`)
      }
    }
  }

  ensureAnims(scene: Phaser.Scene): void {
    const add = (key: string, prefix: string, count: number, rate: number, repeat: number | boolean = -1) => {
      const full = `player_sword_${key}`
      if (scene.anims.exists(full)) return
      const frames = Array.from({ length: count }, (_, i) => ({ key: `player_sword_${prefix}_${i + 1}` }))
      scene.anims.create({ key: full, frames, frameRate: rate, repeat: repeat === -1 ? -1 : 0 })
    }
    add('idle', 'idle', 8, 8, -1)
    add('walk', 'run', 6, 10, -1)
    add('jump', 'jump', 3, 10, 0)
    add('fall', 'fall', 1, 8, -1)
    add('land', 'land', 2, 10, 0)
    // Ground attack animations (1, 2, 3)
    for (let attackNum = 1; attackNum <= 3; attackNum++) {
      const atkKey = `player_sword_attack${attackNum}`
      if (!scene.anims.exists(atkKey)) {
        const frames = Array.from({ length: 3 }, (_, i) => ({ key: `player_sword_attack${attackNum}_${i + 1}` }))
        scene.anims.create({ key: atkKey, frames, frameRate: 14, repeat: 0 })
      }
      // Ground sword effect animations
      const effectKey = `sword_effect_attack${attackNum}_anim`
      if (!scene.anims.exists(effectKey)) {
        const frames = Array.from({ length: 3 }, (_, i) => ({ key: `sword_effect_attack${attackNum}_${i + 1}` }))
        scene.anims.create({ key: effectKey, frames, frameRate: 20, repeat: 0 })
      }
    }
    // Air attack animations (1, 2)
    for (let attackNum = 1; attackNum <= 2; attackNum++) {
      const atkKey = `player_sword_air_attack${attackNum}`
      if (!scene.anims.exists(atkKey)) {
        const frames = Array.from({ length: 3 }, (_, i) => ({ key: `player_sword_air_attack${attackNum}_${i + 1}` }))
        scene.anims.create({ key: atkKey, frames, frameRate: 16, repeat: 0 })
      }
      // Air sword effect animations (2 frames each)
      const effectKey = `sword_effect_air_attack${attackNum}_anim`
      if (!scene.anims.exists(effectKey)) {
        const frames = Array.from({ length: 2 }, (_, i) => ({ key: `sword_effect_air_attack${attackNum}_${i + 1}` }))
        scene.anims.create({ key: effectKey, frames, frameRate: 24, repeat: 0 })
      }
    }
  }

  isPlayingAttack(player: PlayerLike): boolean {
    const key = player.sprite.anims?.currentAnim?.key || ''
    return key.startsWith('player_sword_attack') || key.startsWith('player_sword_air_attack')
  }

  tryStart(player: PlayerLike): boolean {
    const scene = player.scene
    const now = scene.time.now
    const st = this.getState(player)
    
    if (now < st.cooldownUntil) {
      return false
    }
    
    // Check if player is in air first
    const bodyCheck = player.sprite.body as Phaser.Physics.Arcade.Body
    const airCheck = !bodyCheck.blocked.down
    
    // Allow combo continuation if within combo window, even if currently playing attack
    const canContinueCombo = airCheck 
      ? (now < st.airComboWindowUntil)
      : (now < st.comboWindowUntil)
    
    if (this.isPlayingAttack(player) && !canContinueCombo) {
      return false
    }

    this.ensureAnims(scene)
    ;(player as any).armed = true
    ;(player as any).armedUntil = now + 10000
    
    // Check if player is in air
    const playerBody = player.sprite.body as Phaser.Physics.Arcade.Body
    const isInAir = !playerBody.blocked.down
    
    let attackType: 'ground' | 'air'
    let currentComboStep: number
    let animationKey: string
    let effectKey: string
    
    if (isInAir) {
      // Air attack logic
      attackType = 'air'
      const withinWindow = now < st.airComboWindowUntil
      if (withinWindow) {
        // Continue air combo
        currentComboStep = st.airComboStep + 1
        if (currentComboStep > 2) currentComboStep = 1 // Loop back to air attack 1
      } else {
        // Start fresh air combo
        currentComboStep = 1
      }
      st.airComboStep = currentComboStep
      animationKey = `player_sword_air_attack${currentComboStep}`
      effectKey = `sword_effect_air_attack${currentComboStep}_anim`
    } else {
      // Ground attack logic
      attackType = 'ground'
      if (now < st.comboWindowUntil) {
        // Continue ground combo
        currentComboStep = st.comboStep + 1
        if (currentComboStep > 3) currentComboStep = 1 // Loop back to attack 1
      } else {
        // Start fresh ground combo
        currentComboStep = 1
      }
      st.comboStep = currentComboStep
      animationKey = `player_sword_attack${currentComboStep}`
      effectKey = `sword_effect_attack${currentComboStep}_anim`
    }

    st.pendingDamage = this.getDamageFor(attackType, currentComboStep)
    // Roll for critical hit and apply multiplier to pending damage if crit (use per-player config)
    const isCrit = Math.random() < st.critChance
    if (isCrit) {
      st.pendingIsCrit = true
      st.pendingDamage = Math.max(1, Math.round(st.pendingDamage * st.critMultiplier))
    } else {
      st.pendingIsCrit = false
    }
    
    // Play the appropriate attack animation
    player.sprite.anims.play(animationKey, true)

    ensureTinyWhiteTexture(scene)
    const playerSprite = player.sprite
    const body = playerSprite.body as Phaser.Physics.Arcade.Body
    let hitbox = this.getState(player).hitbox
    let swordEffect = this.getState(player).swordEffect
    if (!hitbox) {
      hitbox = scene.physics.add.sprite(playerSprite.x, playerSprite.y, 'empty')
      hitbox.setVisible(false)
      const hbBody = hitbox.body as Phaser.Physics.Arcade.Body | null
      if (hbBody) {
        hbBody.allowGravity = false
        hbBody.enable = false
      }
      this.getState(player).hitbox = hitbox
    }
    if (!swordEffect) {
      swordEffect = scene.add.sprite(playerSprite.x, playerSprite.y, 'sword_effect_attack1_1')
      swordEffect.setVisible(false)
      swordEffect.setOrigin(0.5, 0.5)
      this.getState(player).swordEffect = swordEffect
    }
    
    // Set up collision detection if not already done
    if (!this.getState(player).collider) {
      // Overlap: damage only actual overlaps (hitbox is small and placed in front)
      const enemiesGroup: Phaser.Physics.Arcade.Group | undefined = (scene as any).enemiesGroup
      if (enemiesGroup) {
        // Track hit enemies for this attack
        let hitEnemies = new Map<Phaser.Physics.Arcade.Sprite, number>()
        const collider = scene.physics.add.overlap(hitbox, enemiesGroup, (hb, enemyObj) => {
          const hbBody2 = (hitbox!.body as Phaser.Physics.Arcade.Body | null)
          if (!hbBody2 || !hbBody2.enable) return
          const enemy = enemyObj as Phaser.Physics.Arcade.Sprite
          // Only allow up to maxHitsPerEnemy
          const prevHits = hitEnemies.get(enemy) || 0
          if (prevHits >= this.hitConfig.maxHitsPerEnemy) return
          hitEnemies.set(enemy, prevHits + 1)
          // Only allow up to maxEnemiesPerAttack
          if (hitEnemies.size > this.hitConfig.maxEnemiesPerAttack) return
          const dir = playerSprite.flipX ? -1 : 1
          // Apply configured knockback and trigger hit anim
          const pendingDamage = Math.max(1, Math.round(this.getState(player).pendingDamage))
          const st2 = this.getState(player)
          applyEnemyHit(scene, enemy, captainSwordKnockback, dir, 0.25, pendingDamage, { critical: st2.pendingIsCrit, critKnockbackMultiplier: st2.critKnockbackMultiplier })
        })
        this.getState(player).collider = collider as any
        // Reset hitEnemies after each attack animation completes
        playerSprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          hitEnemies = new Map<Phaser.Physics.Arcade.Sprite, number>()
        })
      }
    }

    // Size/position hitbox using player's body (close range in front)
    const bw = Math.max(1, body.width)
    const bh = Math.max(1, body.height)
    const hbW = Math.round(bw * captainMeleeRange.widthFactor)
    const hbH = Math.round(bh * captainMeleeRange.heightFactor)
    const hbBody3 = hitbox.body as Phaser.Physics.Arcade.Body | null
    if (hbBody3) hbBody3.setSize(hbW, hbH, true)
    const xoff = Math.round((bw / 2) + hbW * captainMeleeRange.forwardFactor)
    const facing = playerSprite.flipX ? -1 : 1
    hitbox.setPosition(playerSprite.x + facing * xoff, playerSprite.y + (captainMeleeRange.yOffset ?? 0))
    // Position sword effect at the same location as hitbox
    swordEffect.setPosition(playerSprite.x + facing * xoff, playerSprite.y + (captainMeleeRange.yOffset ?? 0))
    swordEffect.setFlipX(playerSprite.flipX)

    // Activate the hitbox briefly mid-swing
    if (hbBody3) hbBody3.enable = false
    scene.time.delayedCall(80, () => { 
      const b = hitbox!.body as Phaser.Physics.Arcade.Body | null
      if (b) b.enable = true
      // Show and play sword effect animation using the determined effect key
      if (swordEffect) {
        swordEffect.setVisible(true)
        swordEffect.play(effectKey)
      }
    })
    scene.time.delayedCall(170, () => { 
      const b = hitbox?.body as Phaser.Physics.Arcade.Body | null
      if (b) b.enable = false
      // Hide sword effect
      if (swordEffect) {
        swordEffect.setVisible(false)
      }
    })

    // Cooldown and completion
    st.cooldownUntil = now + 200 // Shorter cooldown for combo fluidity
    st.lastAttackAt = now
    // Set combo window based on attack type
    if (attackType === 'air') {
      st.airComboWindowUntil = now + 1000 // 1000ms window for air combo (more time needed due to air movement)
    } else {
      st.comboWindowUntil = now + 800 // 800ms window to continue ground combo
    }
    
    // Revert to idle after the attack completes if standing still
    playerSprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      const b = hitbox?.body as Phaser.Physics.Arcade.Body | null
      if (b) b.enable = false
      // Ensure sword effect is hidden
      if (swordEffect) swordEffect.setVisible(false)
      const sb = playerSprite.body as Phaser.Physics.Arcade.Body
      if (Math.abs(sb.velocity.x) < 1 && sb.blocked.down) {
        playerSprite.play('player_sword_idle')
      }
    })
    return true
  }

  update(player: PlayerLike, dt: number): void {
    // Reposition hitbox and sword effect to follow player while active so fast movement stays aligned
    const s = player.sprite
    const st = this.getState(player)
    const hitbox = st.hitbox
    const swordEffect = st.swordEffect
    if (!hitbox) return
    const hbBody4 = hitbox.body as Phaser.Physics.Arcade.Body | null
    if (hbBody4 && hbBody4.enable) {
      const body = s.body as Phaser.Physics.Arcade.Body
      const bw = Math.max(1, body.width)
      const bh = Math.max(1, body.height)
      const hbW = Math.round(bw * captainMeleeRange.widthFactor)
      const xoff = Math.round((bw / 2) + hbW * captainMeleeRange.forwardFactor)
      const facing = s.flipX ? -1 : 1
      hitbox.setPosition(s.x + facing * xoff, s.y + (captainMeleeRange.yOffset ?? 0))
      // Also reposition sword effect if it's visible
      if (swordEffect && swordEffect.visible) {
        swordEffect.setPosition(s.x + facing * xoff, s.y + (captainMeleeRange.yOffset ?? 0))
        swordEffect.setFlipX(s.flipX)
      }
    }
  }

  debugDraw(player: PlayerLike, gfx: Phaser.GameObjects.Graphics): void {
    const st = this.getState(player)
    const hitbox = st.hitbox
    if (!hitbox) return
    const b = hitbox.body as Phaser.Physics.Arcade.Body | null
    if (!b) return
    const wasLine = (gfx as any)._lineWidth || 0
    try {
      gfx.lineStyle(1, 0x22ff22, b.enable ? 0.9 : 0.35)
      gfx.strokeRect(b.x, b.y, b.width, b.height)
    } finally {
      if (wasLine) gfx.lineStyle(wasLine, 0xffffff, 1)
    }
  }
}

export function getAttackStrategyForSkin(skin: PlayerSkin): AttackStrategy {
  const key = (skin?.key || '').toLowerCase()
  if (key.includes('bomb')) return new BombThrowAttack()
  if (key.startsWith('captain-clown')) return new CaptainMeleeAttack()
  return new NoopAttack()
}

export function preloadAttackAssetsForSkin(scene: Phaser.Scene, skin: PlayerSkin) {
  getAttackStrategyForSkin(skin).preload(scene)
}

export function ensureAttackAnimationsForSkin(scene: Phaser.Scene, skin: PlayerSkin) {
  getAttackStrategyForSkin(skin).ensureAnims(scene)
}

export function isAttackAnimKey(key: string | undefined | null): boolean {
  const k = key || ''
  return k.startsWith('player_sword_attack') || k.startsWith('player_sword_air_attack') || k === 'player_attack'
}
