import Phaser from 'phaser'
import type { PlayerSkin } from './skins/PlayerSkin'
import { CaptainClownSkin } from './skins/CaptainClown'

export type PlayerOptions = {
  maxSpeed?: number
  accel?: number
  drag?: number
  jumpSpeed?: number
  coyoteTime?: number
  jumpBufferTime?: number
  downDoubleTapWindow?: number
  dropThroughDuration?: number
  // Visual + physics tuning (per-skin overrides)
  desiredDisplayHeight?: number // target on-screen height in px; scales frames proportionally
  origin?: { x: number; y: number } // default bottom-center so feet sit on ground
  body?: { width?: number; height?: number; offsetX?: number; offsetY?: number } // Arcade body in source-frame pixels
  skin?: PlayerSkin
}

export class Player {
  sprite!: Phaser.Physics.Arcade.Sprite
  scene: Phaser.Scene
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  keyA!: Phaser.Input.Keyboard.Key
  keyD!: Phaser.Input.Keyboard.Key

  maxSpeed: number
  accel: number
  drag: number
  jumpSpeed: number
  coyoteTime: number
  jumpBufferTime: number
  lastOnGround = 0
  lastJumpPress = 0
  lastDownPress = 0
  dropThroughUntil = 0
  downDoubleTapWindow: number
  dropThroughDuration: number
  private wasOnGround = false
  // skin/physics
  desiredDisplayHeight: number
  origin: { x: number; y: number }
  bodyCfg?: { width?: number; height?: number; offsetX?: number; offsetY?: number }
  skin: PlayerSkin
  // debug + runtime tuning
  debugEnabled = false
  private baseW = 0
  private baseH = 0
  private scaleFactor = 1
  private bodySrc = { width: 0, height: 0, offsetX: 0, offsetY: 0 }

  constructor(scene: Phaser.Scene, opts: PlayerOptions = {}) {
    this.scene = scene
    this.maxSpeed = opts.maxSpeed ?? 200
    this.accel = opts.accel ?? 1200
    this.drag = opts.drag ?? 800
    this.jumpSpeed = opts.jumpSpeed ?? 420
    this.coyoteTime = opts.coyoteTime ?? 100
    this.jumpBufferTime = opts.jumpBufferTime ?? 120
    this.downDoubleTapWindow = opts.downDoubleTapWindow ?? 250
    this.dropThroughDuration = opts.dropThroughDuration ?? 100
    // Captain Clown Nose frames are 64x40; scale to ~58px tall like Bomb Guy
    this.skin = opts.skin ?? CaptainClownSkin
    this.desiredDisplayHeight = opts.desiredDisplayHeight ?? this.skin.desiredDisplayHeight
    this.origin = opts.origin ?? this.skin.origin
    this.bodyCfg = opts.body ?? this.skin.body
  }

  static preload(scene: Phaser.Scene, skin: PlayerSkin = CaptainClownSkin) {
    skin.preload(scene)
  }

  static createAnimations(scene: Phaser.Scene, skin: PlayerSkin = CaptainClownSkin) {
    if (!scene.anims.exists('player_idle')) {
      scene.anims.create({
        key: 'player_idle',
        frames: Array.from({ length: skin.idleCount }, (_, i) => ({ key: `player_idle_${i + 1}` })),
        frameRate: skin.idleRate,
        repeat: -1
      })
    }
    if (!scene.anims.exists('player_walk')) {
      scene.anims.create({
        key: 'player_walk',
        frames: Array.from({ length: skin.runCount }, (_, i) => ({ key: `player_run_${i + 1}` })),
        frameRate: skin.runRate,
        repeat: -1
      })
    }
    const addAnim = (key: string, count?: number, rate?: number, repeat: number | boolean = 0) => {
      if (!count || count <= 0) return
      const fullKey = `player_${key}`
      if (scene.anims.exists(fullKey)) return
      scene.anims.create({
        key: fullKey,
        frames: Array.from({ length: count }, (_, i) => ({ key: `player_${key}_${i + 1}` })),
        frameRate: rate ?? 10,
        repeat: repeat === -1 ? -1 : repeat ? -1 : 0
      })
    }
    addAnim('jump', skin.jumpCount, skin.jumpRate, 0)
    addAnim('fall', skin.fallCount, skin.fallRate, -1)
    addAnim('land', skin.landCount, skin.landRate, 0)
    addAnim('hit', skin.hitCount, skin.hitRate, 0)
    addAnim('dead_hit', skin.deadHitCount, skin.deadHitRate, 0)
    addAnim('dead_ground', skin.deadGroundCount, skin.deadGroundRate, 0)
  }

  spawn(x: number, y: number) {
    const s = this.scene.physics.add.sprite(x, y, 'player_idle_1')
    this.sprite = s
    s.setCollideWorldBounds(true)
    s.setBounce(0.05)
    // Set origin (default center) and scale to desired display height
    s.setOrigin(this.origin.x, this.origin.y)
    const baseW = s.frame.width
    const baseH = s.frame.height
    const scale = (this.desiredDisplayHeight && baseH > 0)
      ? (this.desiredDisplayHeight / baseH)
      : 1
    this.baseW = baseW
    this.baseH = baseH
    this.scaleFactor = scale
    if (scale !== 1) s.setScale(scale)

    const body = s.body as Phaser.Physics.Arcade.Body
    body.setMaxVelocity(this.maxSpeed, 1000)
    body.setDrag(this.drag, 0)

    // Tighten physics body to ignore horizontal transparent margins.
    // Note: Arcade body sizes are set in source-frame pixels (pre-scale).
    const bwSrc = this.bodyCfg?.width ?? Math.round(baseW * 0.3)
    const bhSrc = this.bodyCfg?.height ?? Math.round(baseH * 0.93)
    const offXSrc = this.bodyCfg?.offsetX ?? Math.round((baseW - bwSrc) / 2)
    const offYSrc = this.bodyCfg?.offsetY ?? Math.round(baseH - bhSrc)
    this.bodySrc = { width: bwSrc, height: bhSrc, offsetX: offXSrc, offsetY: offYSrc }
    this.applyBodyFromSrc()

    // input
    this.cursors = this.scene.input.keyboard!.createCursorKeys()
    this.keyA = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)

    // jump buffer
    this.scene.input.keyboard!.on('keydown-SPACE', () => {
      this.lastJumpPress = this.scene.time.now
    })

    // drop-through double-tap down
    const onDown = () => {
      const now = this.scene.time.now
      if (now - this.lastDownPress <= this.downDoubleTapWindow) {
        this.dropThroughUntil = now + this.dropThroughDuration
        const b = this.sprite.body as Phaser.Physics.Arcade.Body
        if (b.velocity.y <= 40) b.setVelocityY(40)
      } else {
        this.lastDownPress = now
      }
    }
    this.scene.input.keyboard!.on('keydown-DOWN', onDown)
    this.scene.input.keyboard!.on('keydown-S', onDown)

    // start anim
    s.play('player_idle')
    return s
  }

  private applyBodyFromSrc() {
    if (!this.sprite) return
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    const bw = Math.max(1, Math.round(this.bodySrc.width * this.scaleFactor))
    const bh = Math.max(1, Math.round(this.bodySrc.height * this.scaleFactor))
    const offX = Math.round(this.bodySrc.offsetX * this.scaleFactor)
    const offY = Math.round(this.bodySrc.offsetY * this.scaleFactor)
    body.setSize(bw, bh)
    body.setOffset(offX, offY)
  }

  setBodySrc(next: Partial<{ width: number; height: number; offsetX: number; offsetY: number }>) {
    this.bodySrc = {
      width: Math.max(1, next.width ?? this.bodySrc.width),
      height: Math.max(1, next.height ?? this.bodySrc.height),
      offsetX: Math.max(0, next.offsetX ?? this.bodySrc.offsetX),
      offsetY: Math.max(0, next.offsetY ?? this.bodySrc.offsetY),
    }
    this.applyBodyFromSrc()
  }

  getBodySrc() {
    return { ...this.bodySrc }
  }

  drawDebug(gfx: Phaser.GameObjects.Graphics) {
    if (!this.sprite) return
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    gfx.lineStyle(2, 0x00ff88, 0.9)
    gfx.strokeRect(body.x, body.y, body.width, body.height)
    // crosshair at sprite origin
    const sx = this.sprite.x
    const sy = this.sprite.y
    gfx.lineStyle(1, 0xffcc00, 0.9)
    gfx.strokeRect(sx - 2, sy - 2, 4, 4)
  }

  handleOneWayProcess(obj: any, plat: any) {
    const body = obj?.body as Phaser.Physics.Arcade.Body
    const pBody = plat?.body as Phaser.Physics.Arcade.StaticBody
    if (!body || !pBody) return false
    if (obj === this.sprite && this.scene.time.now < this.dropThroughUntil) return false
    if (body.velocity.y >= 0) {
      const playerBottom = body.bottom
      const platformTop = pBody.top
      return playerBottom <= platformTop + 4
    }
    return false
  }

  update() {
    if (!this.sprite || !this.cursors) return
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    const now = this.scene.time.now

    if (body.blocked.down) this.lastOnGround = now

    const left = this.cursors.left.isDown || this.keyA.isDown
    const right = this.cursors.right.isDown || this.keyD.isDown

    if (left) {
      body.setAccelerationX(-this.accel)
      this.sprite.setFlipX(true)
      // horizontal anim will be resolved after vertical state
    } else if (right) {
      body.setAccelerationX(this.accel)
      this.sprite.setFlipX(false)
      // horizontal anim will be resolved after vertical state
    } else {
      body.setAccelerationX(0)
      if (Math.abs(body.velocity.x) < 10) body.setVelocityX(0)
      // horizontal anim will be resolved after vertical state
    }

    const wantsToJump = (this.cursors.up.isDown || (now - this.lastJumpPress) < this.jumpBufferTime)
    const canUseCoyote = (now - this.lastOnGround) <= this.coyoteTime
    if (wantsToJump && (body.blocked.down || canUseCoyote)) {
      this.sprite.setVelocityY(-this.jumpSpeed)
      this.lastJumpPress = 0
      this.lastOnGround = 0
    }

    if (!this.cursors.up.isDown && !this.cursors.space.isDown && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y * 0.6)
    }

    // vertical state animations
    const vy = body.velocity.y
    const onGround = body.blocked.down
    if (!onGround) {
      // console.log(`In air: jump (rising) or fall (falling) (vy: ${vy} • onGround: ${onGround})`)
      // In air: jump (rising) or fall (falling)
      if (vy < -10 && this.scene.anims.exists('player_jump')) {
        if (this.sprite.anims.currentAnim?.key !== 'player_jump') this.sprite.play('player_jump')
      } else if (vy > 10 && this.scene.anims.exists('player_fall')) {
        if (this.sprite.anims.currentAnim?.key !== 'player_fall') this.sprite.play('player_fall')
      }
    } else {
      // console.log(`On ground: (vy: ${vy} • onGround: ${onGround})`)
      // On landing, play 'land' only on air->ground transition
      if (!this.wasOnGround && this.scene.anims.exists('player_land')) {
        this.sprite.play('player_land')
      }
      // If not playing a non-interruptible land, choose walk/idle based on horizontal input
      const playing = this.sprite.anims?.currentAnim?.key
      const landActive = (playing === 'player_land') && !!this.sprite.anims?.isPlaying
      // console.log(`0. Player (player_land: ${playing} • active: ${landActive} • onGround: ${onGround})`)
      if (!landActive) {
        if (left || right) {
          if (this.scene.anims.exists('player_walk') && playing !== 'player_walk') this.sprite.play('player_walk')
        } else {
          // console.log(`1. Playing idle animation (playing: ${playing} • onGround: ${onGround} • wasOnGround: ${this.wasOnGround} • animation exists: ${this.scene.anims.exists('player_idle')})`)
          if (this.scene.anims.exists('player_idle') && playing !== 'player_idle') this.sprite.play('player_idle')
        }
      }
    }
    this.wasOnGround = onGround
  }
}
