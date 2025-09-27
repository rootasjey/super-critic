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

export interface AttackStrategy {
  preload(scene: Phaser.Scene): void
  ensureAnims(scene: Phaser.Scene): void
  tryStart(player: PlayerLike): boolean
  isPlayingAttack(player: PlayerLike): boolean
  update(player: PlayerLike, dt: number): void
  shouldArmPlayer?(player: PlayerLike): boolean
  debugDraw?(player: PlayerLike, gfx: Phaser.GameObjects.Graphics): void
}
