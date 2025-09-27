import Phaser from 'phaser'
import type { PlayerSkin } from '~/game/skins/PlayerSkin'

export type AttackHitConfig = {
  maxHitsPerEnemy: number
  maxEnemiesPerAttack: number
}

export type PlayerLike = {
  scene: Phaser.Scene
  sprite: Phaser.Physics.Arcade.Sprite
  skin: PlayerSkin
  armed?: boolean
  armedUntil?: number
}

export type AttackOverrideContext = {
  skin: PlayerSkin
  player?: PlayerLike
}

export type AttackOverrideConfig = {
  hitConfig?: Partial<AttackHitConfig>
  melee?: {
    range?: Partial<{ widthFactor: number; heightFactor: number; forwardFactor: number; yOffset?: number }>
    knockback?: Partial<{ x: number; y: number }>
    crit?: {
      chance?: number
      multiplier?: number
      knockbackMultiplier?: number
    }
    damage?: {
      groundMultiplier?: number
      airMultiplier?: number
    }
  }
  bomb?: {
    cooldownMs?: number
    postExplosionCooldownMs?: number
    fuse?: { base?: number; min?: number }
    radius?: { min?: number; max?: number }
    damage?: { min?: number; max?: number }
  }
}

export interface AttackStrategy {
  preload(scene: Phaser.Scene): void
  ensureAnims(scene: Phaser.Scene): void
  tryStart(player: PlayerLike): boolean
  isPlayingAttack(player: PlayerLike): boolean
  update(player: PlayerLike, dt: number): void
  shouldArmPlayer?(player: PlayerLike): boolean
  debugDraw?(player: PlayerLike, gfx: Phaser.GameObjects.Graphics): void
  applySkinOverrides?(overrides: AttackOverrideConfig, context: AttackOverrideContext): void
  resetSkinOverrides?(context: AttackOverrideContext): void
}
