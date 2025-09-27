import Phaser from 'phaser'
import type { PlayerSkin } from '~/game/skins/PlayerSkin'
import { BombThrowAttack } from './BombThrowAttack'
import { CaptainMeleeAttack, configureCaptainMeleeRange, configureCaptainSwordKnockback } from './CaptainMeleeAttack'
import type { AttackHitConfig, AttackStrategy, PlayerLike } from './types'

class NoopAttack implements AttackStrategy {
  preload(): void {}
  ensureAnims(): void {}
  tryStart(): boolean { return false }
  isPlayingAttack(): boolean { return false }
  update(): void {}
  shouldArmPlayer(): boolean { return false }
  debugDraw(): void {}
}

export { BombThrowAttack, CaptainMeleeAttack, configureCaptainMeleeRange, configureCaptainSwordKnockback }
export type { AttackHitConfig, AttackStrategy, PlayerLike }

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
