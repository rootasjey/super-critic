import Phaser from 'phaser'
import type { PlayerSkin } from '~/game/skins/PlayerSkin'
import { BombThrowAttack } from './BombThrowAttack'
import { CaptainMeleeAttack, configureCaptainMeleeRange, configureCaptainSwordKnockback } from './CaptainMeleeAttack'
import type { AttackHitConfig, AttackOverrideConfig, AttackStrategy, PlayerLike } from './types'

class NoopAttack implements AttackStrategy {
  preload(): void {}
  ensureAnims(): void {}
  tryStart(): boolean { return false }
  isPlayingAttack(): boolean { return false }
  update(): void {}
  shouldArmPlayer(): boolean { return false }
  debugDraw(): void {}
}

const DEFAULT_SKIN_KEY = '__default__'
const strategyCache = new Map<string, AttackStrategy>()
const overrideCache = new Map<string, AttackOverrideConfig>()

export {
  BombThrowAttack,
  CaptainMeleeAttack,
  configureCaptainMeleeRange,
  configureCaptainSwordKnockback,
  resetAttackStrategyCache,
}
export type { AttackHitConfig, AttackOverrideConfig, AttackStrategy, PlayerLike }

function normalizeSkinKey(skin: PlayerSkin | null | undefined): string {
  const key = (skin?.key || '').toLowerCase()
  return key || DEFAULT_SKIN_KEY
}

function createStrategyForKey(normalizedKey: string): AttackStrategy {
  if (normalizedKey.includes('bomb')) return new BombThrowAttack()
  if (normalizedKey.startsWith('captain-clown')) return new CaptainMeleeAttack()
  return new NoopAttack()
}

function resetAttackStrategyCache(): void {
  strategyCache.clear()
}

export function getAttackStrategyForSkin(skin: PlayerSkin): AttackStrategy {
  const normalizedKey = normalizeSkinKey(skin)
  let strategy = strategyCache.get(normalizedKey)
  if (!strategy) {
    strategy = createStrategyForKey(normalizedKey)
    strategyCache.set(normalizedKey, strategy)
  }
  const overrides = overrideCache.get(normalizedKey)
  if (typeof strategy.resetSkinOverrides === 'function') {
    strategy.resetSkinOverrides({ skin })
  }
  if (overrides && typeof strategy.applySkinOverrides === 'function') {
    strategy.applySkinOverrides(overrides, { skin })
  }
  return strategy
}

export function setAttackOverridesForSkin(skin: PlayerSkin, overrides?: AttackOverrideConfig | null): void {
  const normalizedKey = normalizeSkinKey(skin)
  if (!overrides || Object.keys(overrides).length === 0) {
    overrideCache.delete(normalizedKey)
  } else {
    overrideCache.set(normalizedKey, overrides)
  }
  const strategy = strategyCache.get(normalizedKey)
  if (strategy) {
    if (typeof strategy.resetSkinOverrides === 'function') {
      strategy.resetSkinOverrides({ skin })
    }
    if (overrides && typeof strategy.applySkinOverrides === 'function') {
      strategy.applySkinOverrides(overrides, { skin })
    }
  }
}

export function getAttackOverridesForSkin(skin: PlayerSkin): AttackOverrideConfig | undefined {
  return overrideCache.get(normalizeSkinKey(skin))
}

export function clearAttackOverridesForSkin(skin: PlayerSkin): void {
  setAttackOverridesForSkin(skin, null)
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
