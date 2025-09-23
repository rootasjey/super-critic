import Phaser from 'phaser'

export function fitCameraToMap(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap) {
  const cam = scene.cameras.main
  const fitZoom = Math.min(scene.scale.width / map.widthInPixels, scene.scale.height / map.heightInPixels)
  cam.setZoom(fitZoom)
  cam.centerOn(map.widthInPixels / 2, map.heightInPixels / 2)
}

export function clearCameraEffects(scene: Phaser.Scene) {
  const cam = scene.cameras.main as any
  try {
    if (typeof cam.resetFX === 'function') cam.resetFX()
  } catch {}
}
