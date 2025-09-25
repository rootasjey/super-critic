import Phaser from 'phaser'
import type { PlayerSkin } from '~/game/skins/PlayerSkin'
import { ensureTinyWhiteTexture } from '~/game/systems/objects'
import { applyEnemyHit } from '~/game/enemies/ai'

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
  debugDraw?(player: PlayerLike, gfx: Phaser.GameObjects.Graphics): void
}

class NoopAttack implements AttackStrategy {
  preload(): void {}
  ensureAnims(): void {}
  tryStart(): boolean { return false }
  isPlayingAttack(): boolean { return false }
  update(): void {}
  debugDraw(): void {}
}

// Captain melee: uses sword variant frames under player_sword_* and attack-1
type KnockbackConfig = { x: number; y: number }
const defaultCaptainSwordKnockback: KnockbackConfig = { x: 220, y: -100 }
let captainSwordKnockback: KnockbackConfig = { ...defaultCaptainSwordKnockback }
export function configureCaptainSwordKnockback(overrides: Partial<KnockbackConfig>) {
  captainSwordKnockback = { ...captainSwordKnockback, ...overrides }
}

class CaptainMeleeAttack implements AttackStrategy {
  private state = new WeakMap<PlayerLike, {
    cooldownUntil: number
    hitbox?: Phaser.Physics.Arcade.Sprite
    collider?: Phaser.Physics.Arcade.Collider
    lastAttackAt: number
    swordEffect?: Phaser.GameObjects.Sprite
    comboStep: number // 1, 2, or 3 for ground attacks
    comboWindowUntil: number // Time window to continue ground combo
    airComboStep: number // 1 or 2 for air attacks
    airComboWindowUntil: number // Time window to continue air combo
  }>()

  private getState(p: PlayerLike) {
    let s = this.state.get(p)
    if (!s) { 
      s = { 
        cooldownUntil: 0, 
        lastAttackAt: 0, 
        comboStep: 1, 
        comboWindowUntil: 0,
        airComboStep: 1,
        airComboWindowUntil: 0
      } 
      this.state.set(p, s) 
    }
    return s
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
        const collider = scene.physics.add.overlap(hitbox, enemiesGroup, (hb, enemyObj) => {
          const hbBody2 = (hitbox!.body as Phaser.Physics.Arcade.Body | null)
          if (!hbBody2 || !hbBody2.enable) return
          const enemy = enemyObj as Phaser.Physics.Arcade.Sprite
          const dir = playerSprite.flipX ? -1 : 1
          // Apply configured knockback and trigger hit anim
          applyEnemyHit(scene, enemy, captainSwordKnockback, dir, 0.25)
        })
        this.getState(player).collider = collider as any
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
