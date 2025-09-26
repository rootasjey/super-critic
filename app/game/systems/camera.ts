import Phaser from 'phaser'

export interface CameraFollowOptions {
  lerp?: number | { x?: number; y?: number }
  offset?: { x?: number; y?: number }
  deadzone?: {
    width?: number
    height?: number
    fractionX?: number
    fractionY?: number
  }
  roundPixels?: boolean
}

export function fitCameraToMap(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap) {
  const cam = scene.cameras.main
  cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels)

  const baseWidth = scene.scale.gameSize.width
  const baseHeight = scene.scale.gameSize.height
  const zoomCandidate = Math.min(baseWidth / map.widthInPixels, baseHeight / map.heightInPixels)
  const zoom = Math.max(1, zoomCandidate || 1)
  cam.setZoom(zoom)

  cam.centerOn(map.widthInPixels / 2, map.heightInPixels / 2)
}

export function startCameraFollow(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform,
  options: CameraFollowOptions = {},
) {
  if (!scene || !target) return

  const cam = scene.cameras.main
  const baseWidth = scene.scale.gameSize.width
  const baseHeight = scene.scale.gameSize.height

  const lerpValue = options.lerp
  const lerpX = Phaser.Math.Clamp(
    typeof lerpValue === 'number' ? lerpValue : lerpValue?.x ?? 0.12,
    0,
    1,
  )
  const lerpY = Phaser.Math.Clamp(
    typeof lerpValue === 'number' ? lerpValue : lerpValue?.y ?? 0.18,
    0,
    1,
  )

  const offsetX = options.offset?.x ?? 0
  const offsetY = options.offset?.y ?? 0

  const dz = options.deadzone ?? {}
  let deadWidth = dz.width
  let deadHeight = dz.height
  if (!deadWidth && dz.fractionX !== undefined) {
    deadWidth = Math.max(0, baseWidth * Phaser.Math.Clamp(dz.fractionX, 0, 1))
  }
  if (!deadHeight && dz.fractionY !== undefined) {
    deadHeight = Math.max(0, baseHeight * Phaser.Math.Clamp(dz.fractionY, 0, 1))
  }
  if (!deadWidth) deadWidth = baseWidth * 0.45
  if (!deadHeight) deadHeight = baseHeight * 0.55

  cam.roundPixels = options.roundPixels ?? true
  cam.setDeadzone(deadWidth, deadHeight)
  cam.startFollow(target, cam.roundPixels, lerpX, lerpY, offsetX, offsetY)
}

export function clearCameraEffects(scene: Phaser.Scene) {
  const cam = scene.cameras.main
  cam.resetFX()
}
