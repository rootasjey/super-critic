import Phaser from 'phaser'
import { Player } from '~/game/Player'
import type { PlayerSkin } from '~/game/skins/PlayerSkin'

export function spawnPlayerFromLayer(
  scene: Phaser.Scene,
  map: Phaser.Tilemaps.Tilemap,
  skin: PlayerSkin,
  solids: Phaser.Physics.Arcade.StaticGroup,
) {
  const playerLayer = map.getObjectLayer('player')
  if (!playerLayer || !playerLayer.objects || playerLayer.objects.length === 0) return null
  const obj = playerLayer.objects.find(o => (o.name || '').toLowerCase() === 'player') || playerLayer.objects[0]
  if (!obj) return null
  const ox = (obj.x ?? 0)
  const oy = (obj.y ?? 0) - (obj.height ?? 0)

  Player.createAnimations(scene, skin)
  const player = new Player(scene as any, { skin })
  const sprite = player.spawn(ox, oy)
  scene.physics.add.collider(sprite, solids)
  ;(sprite as any).__controller = player
  return { player, sprite }
}
