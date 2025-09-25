import Phaser from 'phaser'
import { Player } from '~/game/Player'
import type { PlayerSkin } from '~/game/skins/PlayerSkin'
import { BombGuySkin } from '~/game/skins/BombGuy'
import { CaptainClownSkin } from '~/game/skins/CaptainClown'
import { CaptainClownSwordSkin } from '~/game/skins/CaptainClownSword'
import { ASSETS } from '~/game/config/assets'
import { embedTilesets } from '~/game/systems/tileset'
import { buildCollisionSolids, buildOneWayPlatforms, placeDecorations } from '~/game/systems/objects'
import { preloadEnemyIdleFrames, ensureEnemyIdleAnims, preloadEnemyRunAttackFrames, ensureEnemyRunAttackAnims } from '~/game/enemies/animations'
import { placeEnemies } from '~/game/enemies/spawn'
import { updateEnemyAI, getEnemyData } from '~/game/enemies/ai'
import { spawnPlayerFromLayer } from '~/game/systems/player'
import { ensureAttackAnimationsForSkin, preloadAttackAssetsForSkin } from '~/game/systems/attack'
import { fitCameraToMap } from '~/game/systems/camera'
import { setupPlayerDebug } from '~/game/systems/debug'
import { onSceneTeardown, teardownSceneDefaults } from '~/game/systems/lifecycle'
import { embeddedMapCacheKey, rawMapCacheKey, getSelectedMap } from '~/game/config/maps'
import { useDebugStore } from '@/stores/debug'
import { attachHealthToPlayer, HealthBarHUD } from '~/game/systems/health'

export function getSelectedSkin(): PlayerSkin {
  try {
    const params = new URLSearchParams(window.location.search)
    const v = (params.get('skin') || '').toLowerCase()
    if (v === 'bomb' || v === 'bomb-guy' || v === 'bombguy') return BombGuySkin
    if (v === 'captain-sword' || v === 'captain-clown-sword') return CaptainClownSwordSkin
    return CaptainClownSkin
  } catch {
    return CaptainClownSkin
  }
}

export class StageScene extends Phaser.Scene {
  player!: Player
  map!: Phaser.Tilemaps.Tilemap
  debugGfx!: Phaser.GameObjects.Graphics
  debugEnabled = false
  debugText!: Phaser.GameObjects.Text
  platformsDebugGfx!: Phaser.GameObjects.Graphics
  private debugCleanup?: () => void
  enemiesGroup?: Phaser.Physics.Arcade.Group
  private healthHUD?: HealthBarHUD

  private debugStore = useDebugStore()

  constructor() {
    super({ key: 'StageScene' })
  }

  preload() {
    // images
    for (const [key, url] of Object.entries(ASSETS.images)) {
      this.load.image(key, url)
    }
    // json tilemaps/tilesets
    for (const [key, url] of Object.entries(ASSETS.json)) {
      this.load.json(key, url)
    }

    // Player assets
    const skin = getSelectedSkin()
    Player.preload(this, skin)
    // Attack assets for selected skin
    preloadAttackAssetsForSkin(this, skin)

    // Enemy frames
    preloadEnemyIdleFrames(this)
    preloadEnemyRunAttackFrames(this)
  }

  create() {
    const debugStore = this.debugStore
    // Build embedded map JSON (resolve external tilesets)
    const mapKey = getSelectedMap()
    const rawKey = rawMapCacheKey(mapKey)
    const raw: any = JSON.parse(JSON.stringify(this.cache.json.get(rawKey)))
    embedTilesets(this, raw)

    const embeddedKey = embeddedMapCacheKey(mapKey)
    this.cache.tilemap.add(embeddedKey, { format: Phaser.Tilemaps.Formats.TILED_JSON, data: raw })
    const map = this.make.tilemap({ key: embeddedKey })
    this.map = map

    const tsMain = map.addTilesetImage('pirate-bomb-tileset', 'pirate-bomb')
    const tsBricks = map.addTilesetImage('bricks') || undefined
    const tilesets = [tsMain, tsBricks].filter(Boolean) as Phaser.Tilemaps.Tileset[]

    map.createLayer('bg', tilesets, 0, 0)
    map.createLayer('bg-deco', tilesets, 0, 0)
    map.createLayer('world-bounds', tilesets, 0, 0)
    map.createLayer('platforms', tilesets, 0, 0)

    const solids = buildCollisionSolids(this, map, raw)
    onSceneTeardown(this, () => { try { solids.clear(true, true) } catch {} })

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels)

    // One-way platforms
    const oneWays = buildOneWayPlatforms(this, map)
    onSceneTeardown(this, () => { try { oneWays.clear(true, true) } catch {} })

    // Player spawn
    {
      const skin = getSelectedSkin()
      const created = spawnPlayerFromLayer(this, map, skin, solids)
      if (created) {
        this.player = created.player
        // attach health component (configurable later via difficulty)
        const health = attachHealthToPlayer(this.player, { max: 6 })
        // HUD
        this.healthHUD = new HealthBarHUD(this)
        this.healthHUD.create(health.max, health.current)
        health.emitter.on('health-changed', (cur, max) => {
          this.healthHUD?.updateValues(cur, max)
        })
        health.emitter.on('player-died', () => {
          // simple effect: flash camera
          this.cameras.main.flash(250, 255, 0, 0)
        })
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels)
        const dbg = setupPlayerDebug(this, this.player)
        this.debugGfx = dbg.gfx
        this.platformsDebugGfx = dbg.platformsGfx
        this.debugText = dbg.text
        this.debugCleanup = dbg.cleanup
        this.debugEnabled = debugStore.enabled
        this.player.debugEnabled = debugStore.playerCollider && debugStore.enabled

        // Expose this scene to debug tooling so UI controls can act on it
        try { this.debugStore.phaserScene = this } catch {}

        // Ensure debug teardown when scene shuts down or is destroyed
        this.events.once('shutdown', () => { this.teardownDebug(); teardownSceneDefaults(this) })
        this.events.once('destroy', () => { this.teardownDebug(); teardownSceneDefaults(this) })
      }
    }

    // Ensure enemy animations exist before spawning
    ensureEnemyIdleAnims(this)
    ensureEnemyRunAttackAnims(this)
    const enemiesGroup = placeEnemies(this, map, solids)
    this.enemiesGroup = enemiesGroup
    onSceneTeardown(this, () => { try { enemiesGroup.clear(true, true) } catch {} })

    if (this.player?.sprite && enemiesGroup && enemiesGroup.getLength() > 0) {
      // Damage player on enemy collision
      this.physics.add.collider(this.player.sprite, enemiesGroup, (_player, _enemy) => {
        if (!this.player) return
        this.player.damage(1)
      })
    }

    placeDecorations(this, map)

    // one-way process function using Player's handler
    if (this.player?.sprite && oneWays.getLength() > 0) {
      const processFn = (obj: any, plat: any) => this.player.handleOneWayProcess(obj, plat)
      this.physics.add.collider(this.player.sprite, oneWays, undefined, processFn, this)
    }

    if (oneWays.getLength() > 0) {
      if (enemiesGroup && enemiesGroup.getLength() > 0) {
        const oneWayProcess = (obj: any, plat: any) => {
          const body = obj?.body as Phaser.Physics.Arcade.Body
          const pBody = plat?.body as Phaser.Physics.Arcade.StaticBody
          if (!body || !pBody) return false
          if (body.velocity.y >= 0) {
            const playerBottom = body.bottom
            const platformTop = pBody.top
            return playerBottom <= platformTop + 4
          }
          return false
        }
        this.physics.add.collider(enemiesGroup, oneWays, undefined, oneWayProcess, this)
      }
    }

    // Ensure attack animations ready (after animations manager init)
    ensureAttackAnimationsForSkin(this, getSelectedSkin())

    // center and fit camera
    fitCameraToMap(this, map)
  }

  override update() {
    if (!this.player) return
    const debugStore = this.debugStore
    this.player.update()
    if (this.debugEnabled && this.debugGfx && debugStore.playerCollider) {
      this.debugGfx.clear()
      this.player.drawDebug(this.debugGfx)
      if (this.debugText) {
        const b = this.player.getBodySrc()
        this.debugText.setText(`F3: Collider Debug\nwidth:${b.width} height:${b.height}\noffsetX:${b.offsetX} offsetY:${b.offsetY}`)
      }
    }
    

    if (this.platformsDebugGfx) {
      this.platformsDebugGfx.clear()
      if (this.debugEnabled && debugStore.platformsCollider) {
        this.platformsDebugGfx.lineStyle(1, 0x00aaff, 0.7)
        this.physics.world.staticBodies.iterate((b: Phaser.Physics.Arcade.StaticBody) => {
          if (!b || !b.gameObject) return true
          const body = b as Phaser.Physics.Arcade.StaticBody
          this.platformsDebugGfx.strokeRect(body.x, body.y, body.width, body.height)
          return true
        })
      }
      // Draw enemies' bodies if enabled
      if (this.debugEnabled && debugStore.showEnemiesBody && this.enemiesGroup) {
        this.platformsDebugGfx.lineStyle(1, 0xff00aa, 0.7)
        this.enemiesGroup.children.iterate((obj: Phaser.GameObjects.GameObject) => {
          const s = obj as Phaser.Physics.Arcade.Sprite
          if (s && s.body) {
            const body = s.body as Phaser.Physics.Arcade.Body
            this.platformsDebugGfx.strokeRect(body.x, body.y, body.width, body.height)
            const data = getEnemyData(s)
            const debugHit = data?.debugHitbox
            if (debugHit && this.time.now <= debugHit.expires) {
              this.platformsDebugGfx.lineStyle(1, debugHit.color ?? 0xffaa33, 0.9)
              this.platformsDebugGfx.strokeRect(debugHit.rect.x, debugHit.rect.y, debugHit.rect.width, debugHit.rect.height)
              this.platformsDebugGfx.lineStyle(1, 0xff00aa, 0.7)
            }
          }
          return true
        })
      }
    }

    // update enemies AI
    if (this.enemiesGroup) {
      this.enemiesGroup.children.iterate((obj: Phaser.GameObjects.GameObject) => {
        const s = obj as Phaser.Physics.Arcade.Sprite
        if (s && s.body) {
          updateEnemyAI(this, s, this.player)
        }
        return true
      })
    }
  }

  private teardownDebug() {
    try {
      if (this.debugCleanup) this.debugCleanup()
    } finally {
      this.debugCleanup = undefined
      this.debugEnabled = false
      try { this.debugStore.phaserScene = null } catch {}
    }
  }
}
