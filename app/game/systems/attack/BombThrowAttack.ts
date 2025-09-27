import Phaser from 'phaser'
import { applyEnemyHit } from '~/game/enemies/ai'
import type { StageScene } from '~/game/scenes/StageScene'
import type { AttackStrategy, PlayerLike } from './types'

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

const BOMB_CHARGE_FRAME_KEYS = Array.from({ length: 11 }, (_, i) => `bomb_bar_charge_${i + 1}`)
const BOMB_FULL_FRAME_KEYS = Array.from({ length: 3 }, (_, i) => `bomb_bar_full_${i + 1}`)

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

export class BombThrowAttack implements AttackStrategy {
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
      const frames = Array.from({ length: 10 }, (_, i) => ({ key: `bomb_projectile_on_${i + 1}` }))
      scene.anims.create({ key: 'bomb_projectile_fuse', frames, frameRate: 18, repeat: -1 })
    }
    if (!scene.anims.exists('bomb_projectile_explosion')) {
      const frames = Array.from({ length: 9 }, (_, i) => ({ key: `bomb_projectile_explosion_${i + 1}` }))
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

    if (st.bar?.visible && player.sprite) {
      const sprite = player.sprite
      st.bar.setPosition(sprite.x, sprite.y - sprite.displayHeight * 0.75)
    }

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

  private getState(player: PlayerLike): BombAttackState {
    let state = this.state.get(player)
    if (!state) {
      state = {
        cooldownUntil: 0,
        charging: false,
        chargeStart: 0,
        bombs: new Set(),
      }
      this.state.set(player, state)
    }
    return state
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

    bombData.colliders.forEach(collider => {
      try {
        collider.destroy()
      } catch {}
    })
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
      try {
        sprite.destroy()
      } catch {}
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
