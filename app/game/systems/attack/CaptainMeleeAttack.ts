import Phaser from 'phaser'
import { applyEnemyHit } from '~/game/enemies/ai'
import { ensureTinyWhiteTexture } from '~/game/systems/objects'
import type { AttackHitConfig, AttackOverrideConfig, AttackOverrideContext, AttackStrategy, PlayerLike } from './types'

type MeleeRange = { widthFactor: number; heightFactor: number; forwardFactor: number; yOffset?: number }
const defaultCaptainMeleeRange: MeleeRange = {
  widthFactor: 0.9,
  heightFactor: 0.8,
  forwardFactor: 0.55,
  yOffset: 2,
}
let globalCaptainMeleeRange: MeleeRange = { ...defaultCaptainMeleeRange }

export function configureCaptainMeleeRange(overrides: Partial<MeleeRange>) {
  globalCaptainMeleeRange = { ...globalCaptainMeleeRange, ...overrides }
}

type KnockbackConfig = { x: number; y: number }
const defaultCaptainSwordKnockback: KnockbackConfig = { x: 220, y: -100 }
let globalCaptainSwordKnockback: KnockbackConfig = { ...defaultCaptainSwordKnockback }
export function configureCaptainSwordKnockback(overrides: Partial<KnockbackConfig>) {
  globalCaptainSwordKnockback = { ...globalCaptainSwordKnockback, ...overrides }
}

type CaptainCritConfig = { chance: number; multiplier: number; knockbackMultiplier: number }
const defaultCaptainCrit: CaptainCritConfig = {
  chance: 0.75,
  multiplier: 2,
  knockbackMultiplier: 1.2,
}
let globalCaptainCrit: CaptainCritConfig = { ...defaultCaptainCrit }

const defaultAttackHitConfig: AttackHitConfig = {
  maxHitsPerEnemy: 1,
  maxEnemiesPerAttack: Infinity,
}

type CaptainMeleeState = {
  cooldownUntil: number
  hitbox?: Phaser.Physics.Arcade.Sprite
  collider?: Phaser.Physics.Arcade.Collider
  lastAttackAt: number
  swordEffect?: Phaser.GameObjects.Sprite
  comboStep: number
  comboWindowUntil: number
  airComboStep: number
  airComboWindowUntil: number
  pendingDamage: number
  pendingIsCrit: boolean
  critChance: number
  critMultiplier: number
  critKnockbackMultiplier: number
}

export class CaptainMeleeAttack implements AttackStrategy {
  private state = new WeakMap<PlayerLike, CaptainMeleeState>()
  private hitConfig: AttackHitConfig = { ...defaultAttackHitConfig }
  private range: MeleeRange = { ...globalCaptainMeleeRange }
  private knockback: KnockbackConfig = { ...globalCaptainSwordKnockback }
  private damageMultipliers = { ground: 1, air: 1 }
  private critDefaults: CaptainCritConfig = { ...globalCaptainCrit }

  shouldArmPlayer(): boolean {
    return true
  }

  configureHitBehavior(config: Partial<AttackHitConfig>) {
    this.hitConfig = { ...this.hitConfig, ...config }
  }

  private getState(player: PlayerLike): CaptainMeleeState {
    let state = this.state.get(player)
    if (!state) {
      state = {
        cooldownUntil: 0,
        lastAttackAt: 0,
        comboStep: 1,
        comboWindowUntil: 0,
        airComboStep: 1,
        airComboWindowUntil: 0,
        pendingDamage: 1,
        pendingIsCrit: false,
        critChance: this.critDefaults.chance,
        critMultiplier: this.critDefaults.multiplier,
        critKnockbackMultiplier: this.critDefaults.knockbackMultiplier,
      }
      this.state.set(player, state)
    }
    return state
  }

  private getDamageFor(type: 'ground' | 'air', comboStep: number) {
    let base: number
    if (type === 'ground') {
      base = comboStep >= 3 ? 20 : 10
      return base * this.damageMultipliers.ground
    }
    base = comboStep >= 2 ? 20 : 10
    return base * this.damageMultipliers.air
  }

  configureCritical(opts: { chance?: number; multiplier?: number; knockbackMultiplier?: number }, player?: PlayerLike) {
    if (player) {
      const st = this.getState(player)
      if (typeof opts.chance === 'number') st.critChance = Math.max(0, Math.min(1, opts.chance))
      if (typeof opts.multiplier === 'number') st.critMultiplier = Math.max(1, opts.multiplier)
      if (typeof opts.knockbackMultiplier === 'number') st.critKnockbackMultiplier = Math.max(0, opts.knockbackMultiplier)
    } else {
      if (typeof opts.chance === 'number' && Number.isFinite(opts.chance)) {
        globalCaptainCrit.chance = Math.max(0, Math.min(1, opts.chance))
      }
      if (typeof opts.multiplier === 'number' && Number.isFinite(opts.multiplier)) {
        globalCaptainCrit.multiplier = Math.max(1, opts.multiplier)
      }
      if (typeof opts.knockbackMultiplier === 'number' && Number.isFinite(opts.knockbackMultiplier)) {
        globalCaptainCrit.knockbackMultiplier = Math.max(0, opts.knockbackMultiplier)
      }
      this.critDefaults = { ...globalCaptainCrit }
    }
  }

  preload(scene: Phaser.Scene): void {
    const base = '/assets/sprites/player/captain-clown-nose/captain-clown-nose-with-sword'
    const ensure = (key: string, url: string) => {
      if (!scene.textures.exists(key)) scene.load.image(key, url)
    }
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
    loadSeries('attack1', 'attack-1', 3)
    loadSeries('attack2', 'attack-2', 3)
    loadSeries('attack3', 'attack-3', 3)
    loadSeries('air_attack1', 'air-attack-1', 3)
    loadSeries('air_attack2', 'air-attack-2', 3)
    const effectsBase = '/assets/sprites/player/captain-clown-nose/sword-effects'
    for (let attack = 1; attack <= 3; attack++) {
      for (let i = 1; i <= 3; i++) {
        const ii = String(i).padStart(2, '0')
        ensure(`sword_effect_attack${attack}_${i}`, `${effectsBase}/attack-${attack}/attack-${attack}-${ii}.png`)
      }
    }
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
    for (let attackNum = 1; attackNum <= 3; attackNum++) {
      const atkKey = `player_sword_attack${attackNum}`
      if (!scene.anims.exists(atkKey)) {
        const frames = Array.from({ length: 3 }, (_, i) => ({ key: `player_sword_attack${attackNum}_${i + 1}` }))
        scene.anims.create({ key: atkKey, frames, frameRate: 14, repeat: 0 })
      }
      const effectKey = `sword_effect_attack${attackNum}_anim`
      if (!scene.anims.exists(effectKey)) {
        const frames = Array.from({ length: 3 }, (_, i) => ({ key: `sword_effect_attack${attackNum}_${i + 1}` }))
        scene.anims.create({ key: effectKey, frames, frameRate: 20, repeat: 0 })
      }
    }
    for (let attackNum = 1; attackNum <= 2; attackNum++) {
      const atkKey = `player_sword_air_attack${attackNum}`
      if (!scene.anims.exists(atkKey)) {
        const frames = Array.from({ length: 3 }, (_, i) => ({ key: `player_sword_air_attack${attackNum}_${i + 1}` }))
        scene.anims.create({ key: atkKey, frames, frameRate: 16, repeat: 0 })
      }
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

    const bodyCheck = player.sprite.body as Phaser.Physics.Arcade.Body
    const airCheck = !bodyCheck.blocked.down

    const canContinueCombo = airCheck
      ? now < st.airComboWindowUntil
      : now < st.comboWindowUntil

    if (this.isPlayingAttack(player) && !canContinueCombo) {
      return false
    }

    this.ensureAnims(scene)
    ;(player as any).armed = true
    ;(player as any).armedUntil = now + 10000

    const playerBody = player.sprite.body as Phaser.Physics.Arcade.Body
    const isInAir = !playerBody.blocked.down

    let attackType: 'ground' | 'air'
    let currentComboStep: number
    let animationKey: string
    let effectKey: string

    if (isInAir) {
      attackType = 'air'
      const withinWindow = now < st.airComboWindowUntil
      if (withinWindow) {
        currentComboStep = st.airComboStep + 1
        if (currentComboStep > 2) currentComboStep = 1
      } else {
        currentComboStep = 1
      }
      st.airComboStep = currentComboStep
      animationKey = `player_sword_air_attack${currentComboStep}`
      effectKey = `sword_effect_air_attack${currentComboStep}_anim`
    } else {
      attackType = 'ground'
      if (now < st.comboWindowUntil) {
        currentComboStep = st.comboStep + 1
        if (currentComboStep > 3) currentComboStep = 1
      } else {
        currentComboStep = 1
      }
      st.comboStep = currentComboStep
      animationKey = `player_sword_attack${currentComboStep}`
      effectKey = `sword_effect_attack${currentComboStep}_anim`
    }

    st.pendingDamage = this.getDamageFor(attackType, currentComboStep)
    const isCrit = Math.random() < st.critChance
    if (isCrit) {
      st.pendingIsCrit = true
      st.pendingDamage = Math.max(1, Math.round(st.pendingDamage * st.critMultiplier))
    } else {
      st.pendingIsCrit = false
    }

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

    if (!this.getState(player).collider) {
      const enemiesGroup: Phaser.Physics.Arcade.Group | undefined = (scene as any).enemiesGroup
      if (enemiesGroup) {
        let hitEnemies = new Map<Phaser.Physics.Arcade.Sprite, number>()
        const collider = scene.physics.add.overlap(hitbox, enemiesGroup, (hb, enemyObj) => {
          const hbBody2 = hitbox!.body as Phaser.Physics.Arcade.Body | null
          if (!hbBody2 || !hbBody2.enable) return
          const enemy = enemyObj as Phaser.Physics.Arcade.Sprite
          const prevHits = hitEnemies.get(enemy) || 0
          if (prevHits >= this.hitConfig.maxHitsPerEnemy) return
          hitEnemies.set(enemy, prevHits + 1)
          if (hitEnemies.size > this.hitConfig.maxEnemiesPerAttack) return
          const dir = playerSprite.flipX ? -1 : 1
          const pendingDamage = Math.max(1, Math.round(this.getState(player).pendingDamage))
          const st2 = this.getState(player)
          applyEnemyHit(scene, enemy, this.knockback, dir, 0.25, pendingDamage, {
            critical: st2.pendingIsCrit,
            critKnockbackMultiplier: st2.critKnockbackMultiplier,
          })
        })
        this.getState(player).collider = collider as any
        playerSprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          hitEnemies = new Map<Phaser.Physics.Arcade.Sprite, number>()
        })
      }
    }

    const bw = Math.max(1, body.width)
    const bh = Math.max(1, body.height)
  const hbW = Math.round(bw * this.range.widthFactor)
  const hbH = Math.round(bh * this.range.heightFactor)
    const hbBody3 = hitbox.body as Phaser.Physics.Arcade.Body | null
    if (hbBody3) hbBody3.setSize(hbW, hbH, true)
  const xoff = Math.round(bw / 2 + hbW * this.range.forwardFactor)
    const facing = playerSprite.flipX ? -1 : 1
  const yOffset = this.range.yOffset ?? 0
  hitbox.setPosition(playerSprite.x + facing * xoff, playerSprite.y + yOffset)
  swordEffect.setPosition(playerSprite.x + facing * xoff, playerSprite.y + yOffset)
    swordEffect.setFlipX(playerSprite.flipX)

    if (hbBody3) hbBody3.enable = false
    scene.time.delayedCall(80, () => {
      const b = hitbox!.body as Phaser.Physics.Arcade.Body | null
      if (b) b.enable = true
      if (swordEffect) {
        swordEffect.setVisible(true)
        swordEffect.play(effectKey)
      }
    })
    scene.time.delayedCall(170, () => {
      const b = hitbox?.body as Phaser.Physics.Arcade.Body | null
      if (b) b.enable = false
      if (swordEffect) {
        swordEffect.setVisible(false)
      }
    })

    st.cooldownUntil = now + 200
    st.lastAttackAt = now
    if (attackType === 'air') {
      st.airComboWindowUntil = now + 1000
    } else {
      st.comboWindowUntil = now + 800
    }

    playerSprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      const b = hitbox?.body as Phaser.Physics.Arcade.Body | null
      if (b) b.enable = false
      if (swordEffect) swordEffect.setVisible(false)
      const sb = playerSprite.body as Phaser.Physics.Arcade.Body
      if (Math.abs(sb.velocity.x) < 1 && sb.blocked.down) {
        playerSprite.play('player_sword_idle')
      }
    })
    return true
  }

  resetSkinOverrides(_context?: AttackOverrideContext): void {
    this.hitConfig = { ...defaultAttackHitConfig }
    this.range = { ...globalCaptainMeleeRange }
    this.knockback = { ...globalCaptainSwordKnockback }
    this.damageMultipliers = { ground: 1, air: 1 }
    this.critDefaults = { ...globalCaptainCrit }
  }

  applySkinOverrides(overrides: AttackOverrideConfig, context?: AttackOverrideContext): void {
    if (overrides.hitConfig) {
      this.configureHitBehavior(overrides.hitConfig)
    }

    const melee = overrides.melee
    if (melee?.range) {
      this.range = { ...this.range, ...melee.range }
    }
    if (melee?.knockback) {
      this.knockback = { ...this.knockback, ...melee.knockback }
    }
    if (melee?.damage) {
      const { groundMultiplier, airMultiplier } = melee.damage
      if (typeof groundMultiplier === 'number' && Number.isFinite(groundMultiplier)) {
        this.damageMultipliers.ground = Math.max(0, groundMultiplier)
      }
      if (typeof airMultiplier === 'number' && Number.isFinite(airMultiplier)) {
        this.damageMultipliers.air = Math.max(0, airMultiplier)
      }
    }
    if (melee?.crit) {
      const { chance, multiplier, knockbackMultiplier } = melee.crit
      if (typeof chance === 'number' && Number.isFinite(chance)) {
        this.critDefaults.chance = Math.max(0, Math.min(1, chance))
      }
      if (typeof multiplier === 'number' && Number.isFinite(multiplier)) {
        this.critDefaults.multiplier = Math.max(1, multiplier)
      }
      if (typeof knockbackMultiplier === 'number' && Number.isFinite(knockbackMultiplier)) {
        this.critDefaults.knockbackMultiplier = Math.max(0, knockbackMultiplier)
      }
    }

    if (context?.player) {
      const st = this.getState(context.player)
      st.critChance = this.critDefaults.chance
      st.critMultiplier = this.critDefaults.multiplier
      st.critKnockbackMultiplier = this.critDefaults.knockbackMultiplier
    }
  }

  update(player: PlayerLike): void {
    const s = player.sprite
    const st = this.getState(player)
    const hitbox = st.hitbox
    const swordEffect = st.swordEffect
    if (!hitbox) return
    const hbBody = hitbox.body as Phaser.Physics.Arcade.Body | null
    if (hbBody && hbBody.enable) {
      const body = s.body as Phaser.Physics.Arcade.Body
      const bw = Math.max(1, body.width)
      const bh = Math.max(1, body.height)
      const hbW = Math.round(bw * this.range.widthFactor)
      const xoff = Math.round(bw / 2 + hbW * this.range.forwardFactor)
      const facing = s.flipX ? -1 : 1
      const yOffset = this.range.yOffset ?? 0
      hitbox.setPosition(s.x + facing * xoff, s.y + yOffset)
      if (swordEffect && swordEffect.visible) {
        swordEffect.setPosition(s.x + facing * xoff, s.y + yOffset)
        swordEffect.setFlipX(s.flipX)
      }
    }
  }

  debugDraw(player: PlayerLike, gfx: Phaser.GameObjects.Graphics): void {
    const st = this.getState(player)
    const hitbox = st.hitbox
    if (!hitbox) return
    const body = hitbox.body as Phaser.Physics.Arcade.Body | null
    if (!body) return
    const wasLine = (gfx as any)._lineWidth || 0
    try {
      gfx.lineStyle(1, 0x22ff22, body.enable ? 0.9 : 0.35)
      gfx.strokeRect(body.x, body.y, body.width, body.height)
    } finally {
      if (wasLine) gfx.lineStyle(wasLine, 0xffffff, 1)
    }
  }
}
