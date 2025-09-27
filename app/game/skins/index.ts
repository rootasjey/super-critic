import type { PlayerSkin } from './PlayerSkin'
import { BombGuySkin } from './BombGuy'
import { CaptainClownSkin } from './CaptainClown'
import { CaptainClownSwordSkin } from './CaptainClownSword'
import type { AttackOverrideConfig } from '~/game/systems/attack'

export type PlayerSkinDefinition = {
  id: string
  label: string
  skin: PlayerSkin
  description?: string
  aliases?: string[]
  defaultOverrides?: AttackOverrideConfig
}

export const PLAYER_SKINS: PlayerSkinDefinition[] = [
  {
    id: 'captain-clown',
    label: 'Captain Clown',
    skin: CaptainClownSkin,
    aliases: ['captain', 'clown', 'captainclown'],
  },
  {
    id: 'captain-clown-sword',
    label: 'Captain Clown + Sword',
    skin: CaptainClownSwordSkin,
    aliases: ['captain-sword', 'captainsword', 'sword'],
    defaultOverrides: {
      melee: {
        damage: { groundMultiplier: 1.15, airMultiplier: 1.1 },
        crit: { chance: 0.8, multiplier: 2.1, knockbackMultiplier: 1.35 },
      },
    },
  },
  {
    id: 'bomb-guy',
    label: 'Bomb Guy',
    skin: BombGuySkin,
    aliases: ['bomb', 'bombguy'],
    defaultOverrides: {
      bomb: {
        radius: { min: 100, max: 168 },
        damage: { min: 14, max: 30 },
        cooldownMs: 300,
      },
    },
  },
]

export const DEFAULT_SKIN_ID = PLAYER_SKINS[0]!.id

const SKIN_BY_ID = new Map<string, PlayerSkinDefinition>()
const ALIAS_TO_ID = new Map<string, string>()
for (const def of PLAYER_SKINS) {
  SKIN_BY_ID.set(def.id, def)
  for (const alias of def.aliases ?? []) {
    ALIAS_TO_ID.set(alias.toLowerCase(), def.id)
  }
  ALIAS_TO_ID.set(def.id.toLowerCase(), def.id)
}

export function listPlayerSkinOptions(): Array<{ id: string; label: string; description?: string }> {
  return PLAYER_SKINS.map(({ id, label, description }) => ({ id, label, description }))
}

export function resolvePlayerSkinDefinition(id?: string | null): PlayerSkinDefinition {
  if (id) {
    const normalizedId = id.toLowerCase()
    const fromId = SKIN_BY_ID.get(normalizedId)
    if (fromId) return fromId
    const viaAlias = ALIAS_TO_ID.get(normalizedId)
    if (viaAlias) {
      const resolved = SKIN_BY_ID.get(viaAlias)
      if (resolved) return resolved
    }
  }
  return SKIN_BY_ID.get(DEFAULT_SKIN_ID) ?? PLAYER_SKINS[0]!
}

export function resolvePlayerSkinFromQuery(): PlayerSkinDefinition {
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('skin')
    return resolvePlayerSkinDefinition(raw ?? undefined)
  } catch {
    return resolvePlayerSkinDefinition()
  }
}

export function getPlayerSkinTextureKeys(skin: PlayerSkin): string[] {
  const keys: string[] = []
  const pushFrames = (prefix: string, count: number | undefined) => {
    if (!count || count <= 0) return
    for (let i = 1; i <= count; i++) {
      keys.push(`${prefix}_${i}`)
    }
  }

  pushFrames('player_idle', skin.idleCount)
  pushFrames('player_run', skin.runCount)
  pushFrames('player_jump', skin.jumpCount)
  pushFrames('player_fall', skin.fallCount)
  pushFrames('player_land', skin.landCount)
  pushFrames('player_hit', skin.hitCount)
  pushFrames('player_dead_hit', skin.deadHitCount)
  pushFrames('player_dead_ground', skin.deadGroundCount)

  return keys
}
