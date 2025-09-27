import Phaser from 'phaser'
import type { PlayerSkin } from './skins/PlayerSkin'
import { CaptainClownSkin } from './skins/CaptainClown'
import { getAttackStrategyForSkin, isAttackAnimKey } from '~/game/systems/attack'
import { showDamageNumber } from '~/game/systems/damageNumbers'
import type { AttackStrategy } from '~/game/systems/attack'

export type PlayerOptions = {
  maxSpeed?: number
  accel?: number
  drag?: number
  jumpSpeed?: number
  coyoteTime?: number
  jumpBufferTime?: number
  downDoubleTapWindow?: number
  dropThroughDuration?: number
  extraJumps?: number
  wallJumpEnabled?: boolean
  wallJumpHorizontalSpeed?: number
  wallJumpVerticalSpeed?: number
  wallJumpGraceTime?: number
  wallSlideSpeed?: number
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
  keyX!: Phaser.Input.Keyboard.Key

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
  extraJumps = 0
  airJumpsRemaining = 0
  jumpReleased = true
  private wasOnGround = false
  wallJumpEnabled = false
  wallJumpHorizontalSpeed = 0
  wallJumpVerticalSpeed = 0
  wallJumpGraceTime = 0
  wallSlideSpeed = 0
  private lastWallContactLeft = 0
  private lastWallContactRight = 0
  private wallJumpLockUntil = 0
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
  // attack
  private attack!: AttackStrategy
  armed = false
  armedUntil = 0
  private attackPressedAt = 0
  // health (attached dynamically by health system)
  // Using index signature to avoid tight coupling; see systems/health.ts
  // health?: HealthComponent (but we don't import to keep Player lean)

  // Invulnerability
  private invulnUntil = 0
  private invulnFlashTimer = 0
  private invulnFlashOn = false
  private readonly INVULN_DURATION = 1000 // ms
  private readonly INVULN_FLASH_INTERVAL = 80 // ms

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
    this.extraJumps = Math.max(0, Math.floor(opts.extraJumps ?? 0))
    this.airJumpsRemaining = this.extraJumps
    this.wallJumpEnabled = opts.wallJumpEnabled ?? false
    this.wallJumpHorizontalSpeed = Math.abs(opts.wallJumpHorizontalSpeed ?? Math.round(this.maxSpeed * 0.8))
    this.wallJumpVerticalSpeed = opts.wallJumpVerticalSpeed ?? this.jumpSpeed
    this.wallJumpGraceTime = Math.max(0, opts.wallJumpGraceTime ?? 160)
    this.wallSlideSpeed = Math.max(0, opts.wallSlideSpeed ?? 0)
    // Captain Clown Nose frames are 64x40; scale to ~58px tall like Bomb Guy
    this.skin = opts.skin ?? CaptainClownSkin
    this.desiredDisplayHeight = opts.desiredDisplayHeight ?? this.skin.desiredDisplayHeight
    this.origin = opts.origin ?? this.skin.origin
    this.bodyCfg = opts.body ?? this.skin.body
    // attack strategy depends on skin
    this.attack = getAttackStrategyForSkin(this.skin)
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
    const sprite = this.scene.physics.add.sprite(x, y, 'player_idle_1')
    this.sprite = sprite
    sprite.setCollideWorldBounds(true)
    sprite.setBounce(0.05)
    // Set origin (default center) and scale to desired display height
    sprite.setOrigin(this.origin.x, this.origin.y)
    const baseW = sprite.frame.width
    const baseH = sprite.frame.height
    const scale = (this.desiredDisplayHeight && baseH > 0)
      ? (this.desiredDisplayHeight / baseH)
      : 1
    this.baseW = baseW
    this.baseH = baseH
    this.scaleFactor = scale
    if (scale !== 1) sprite.setScale(scale)

    const body = sprite.body as Phaser.Physics.Arcade.Body
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
    this.keyX = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X)

    // jump buffer
    const keyboard = this.scene.input.keyboard!
    const recordJumpPress = () => {
      this.lastJumpPress = this.scene.time.now
    }
    keyboard.on('keydown-SPACE', recordJumpPress)
    keyboard.on('keydown-UP', recordJumpPress)

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
    sprite.play('player_idle')
    this.resetAirJumps()
    this.jumpReleased = true
    return sprite
  }

  private resetAirJumps() {
    this.airJumpsRemaining = this.extraJumps
  }

  private performJump(speed: number) {
    if (!this.sprite) return
    this.sprite.setVelocityY(-speed)
    this.lastJumpPress = 0
    this.lastOnGround = 0
    this.jumpReleased = false
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
    // Attack-specific debug (e.g., melee hitbox)
    if (this.attack && typeof (this.attack as any).debugDraw === 'function') {
      ;(this.attack as any).debugDraw(this as any, gfx)
    }
  }

  handleOneWayProcess(obj: any, plat: any) {
    const body = obj?.body as Phaser.Physics.Arcade.Body
    const pBody = plat?.body as Phaser.Physics.Arcade.StaticBody
    if (!body || !pBody) return false
    if (obj === this.sprite && this.scene.time.now < this.dropThroughUntil) return false
    // Only allow collision if:
    // - player is moving down
    // - player's previous bottom was above the platform's top (not beside or below)
    // - player is horizontally overlapping the platform
    if (body.velocity.y >= 0) {
      const playerBottom = body.bottom
      const playerPrevBottom = body.prev.y + body.height
      const platformTop = pBody.top
      const playerLeft = body.left
      const playerRight = body.right
      const platformLeft = pBody.left
      const platformRight = pBody.right
      const horizontallyOverlapping = playerRight > platformLeft && playerLeft < platformRight
      // Allow collision only if:
      // - moving down
      // - horizontally overlapping
      // - player's bottom is at or just below platform top (with margin)
      // - player's top is above platform top (with margin)
      const playerTop = body.top;
      const margin = 1;
      return (
        horizontallyOverlapping &&
        playerBottom >= platformTop - margin &&
        playerTop < platformTop + margin
      );
    }
    return false
  }

  update() {
    if (!this.sprite || !this.cursors) return
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    const now = this.scene.time.now

    // Invulnerability flash effect
    if (now < this.invulnUntil) {
      if (now > this.invulnFlashTimer) {
        this.invulnFlashOn = !this.invulnFlashOn
        this.sprite.setAlpha(this.invulnFlashOn ? 0.4 : 1)
        this.invulnFlashTimer = now + this.INVULN_FLASH_INTERVAL
      }
    } else if (this.invulnFlashOn) {
      this.sprite.setAlpha(1)
      this.invulnFlashOn = false
    }
    // attack input (edge on keydown)
    if (Phaser.Input.Keyboard.JustDown(this.keyX)) {
      this.attackPressedAt = now
      // Always try to start attack - let the attack system handle combo logic
      const started = this.attack.tryStart(this)
      if (started) {
        const shouldArm = typeof this.attack.shouldArmPlayer === 'function'
          ? this.attack.shouldArmPlayer(this)
          : true
        if (shouldArm) {
          this.armed = true
          this.armedUntil = Math.max(this.armedUntil, now + 10000)
        }
      }
    }
    // armed timeout
    if (this.armed && now > this.armedUntil && !this.attack.isPlayingAttack(this as any)) {
      this.armed = false
    }

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

    const onGround = body.blocked.down
    if (onGround) {
      this.lastOnGround = now
      if (!this.wasOnGround || this.airJumpsRemaining !== this.extraJumps) {
        this.resetAirJumps()
      }
    }

    if (!onGround && (body.blocked.left || body.touching.left)) this.lastWallContactLeft = now
    if (!onGround && (body.blocked.right || body.touching.right)) this.lastWallContactRight = now

    const spaceKey = this.cursors.space
    const jumpKeyDown = this.cursors.up.isDown || (spaceKey?.isDown ?? false)
    if (!jumpKeyDown) this.jumpReleased = true

    const jumpJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up)
      || (spaceKey ? Phaser.Input.Keyboard.JustDown(spaceKey) : false)
    const bufferedJump = (now - this.lastJumpPress) <= this.jumpBufferTime
    const wantsToJump = jumpKeyDown || bufferedJump
    const canUseCoyote = (now - this.lastOnGround) <= this.coyoteTime
    let performedJump = false

    if (wantsToJump) {
      if ((onGround || canUseCoyote) && !performedJump) {
        this.resetAirJumps()
        this.performJump(this.jumpSpeed)
        performedJump = true
      } else if (!onGround && this.wallJumpEnabled && now >= this.wallJumpLockUntil) {
        const canWallJumpLeft = (now - this.lastWallContactLeft) <= this.wallJumpGraceTime
        const canWallJumpRight = (now - this.lastWallContactRight) <= this.wallJumpGraceTime
        if ((canWallJumpLeft || canWallJumpRight) && (jumpJustPressed || bufferedJump) && this.jumpReleased) {
          const horizontal = canWallJumpLeft ? this.wallJumpHorizontalSpeed : -this.wallJumpHorizontalSpeed
          if (horizontal !== 0) body.setVelocityX(horizontal)
          if (horizontal > 0) this.sprite.setFlipX(false)
          else if (horizontal < 0) this.sprite.setFlipX(true)
          const wallJumpY = this.wallJumpVerticalSpeed > 0 ? this.wallJumpVerticalSpeed : this.jumpSpeed
          this.performJump(wallJumpY)
          this.resetAirJumps()
          this.wallJumpLockUntil = now + 180
          performedJump = true
        }
      }

      if (!performedJump && this.airJumpsRemaining > 0 && (jumpJustPressed || bufferedJump) && this.jumpReleased) {
        this.performJump(this.jumpSpeed)
        this.airJumpsRemaining -= 1
        performedJump = true
      }
    }

    if (this.wallJumpEnabled && this.wallSlideSpeed > 0 && !onGround) {
      const huggedLeft = (now - this.lastWallContactLeft) <= this.wallJumpGraceTime
      const huggedRight = (now - this.lastWallContactRight) <= this.wallJumpGraceTime
      const sliding = (huggedLeft && left) || (huggedRight && right)
      if (sliding && body.velocity.y > this.wallSlideSpeed) {
        body.setVelocityY(this.wallSlideSpeed)
      }
    }

    if (!jumpKeyDown && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y * 0.6)
    }

    // vertical state animations
    const vy = body.velocity.y
    const playingKey = this.sprite.anims?.currentAnim?.key || ''
    // Check if attack animation is actually playing (not just the key, but the animation progress)
    let attackActive = isAttackAnimKey(playingKey) && this.sprite.anims.isPlaying

    // If the animation key is an attack but the animation is NOT playing, treat as not active
    if (isAttackAnimKey(playingKey) && !this.sprite.anims.isPlaying) {
      attackActive = false;
    }

    if (!onGround) {
      // In air: jump (rising) or fall (falling)
      if (!attackActive) {
        const jKey = this.animKey('jump')
        const fKey = this.animKey('fall')
        if (vy < -10 && this.scene.anims.exists(jKey)) {
          if (this.sprite.anims.currentAnim?.key !== jKey) this.sprite.play(jKey)
        } else if (vy > 10 && this.scene.anims.exists(fKey)) {
          if (this.sprite.anims.currentAnim?.key !== fKey) this.sprite.play(fKey)
        }
      }
    } else {
      // On landing, play 'land' only on air->ground transition
      if (!this.wasOnGround) {
        const lKey = this.animKey('land')
        if (this.scene.anims.exists(lKey)) this.sprite.play(lKey)
      }
      // If not playing a non-interruptible land, choose walk/idle based on horizontal input
      const playing = this.sprite.anims?.currentAnim?.key || ''
      const landActive = ((playing === 'player_land') || (playing === 'player_sword_land')) && !!this.sprite.anims?.isPlaying
      // If attack animation is no longer active but we're still on an attack frame, force correct anim
      if (!landActive) {
        if (!attackActive && (left || right)) {
          const key = this.animKey('walk')
          if (this.scene.anims.exists(key) && playing !== key) this.sprite.play(key)
        } else if (!attackActive && !left && !right) {
          const key = this.animKey('idle')
          if (this.scene.anims.exists(key) && playing !== key) this.sprite.play(key)
        }
      }
    }
    this.wasOnGround = onGround

    // Update attack system (repositions hitboxes, manages effects)
    this.attack.update(this as any, 0)
  }

  private animKey(name: 'idle' | 'walk' | 'jump' | 'fall' | 'land') {
    const useSword = this.armed || isAttackAnimKey(this.sprite.anims?.currentAnim?.key)
    const prefix = useSword ? 'player_sword_' : 'player_'
    return `${prefix}${name}`
  }

  // Convenience wrappers (no-op if health not attached)
  damage(amount: number) {
    const h: any = (this as any).health
    const now = this.scene.time.now
    if (h && typeof h.damage === 'function') {
      if (now < this.invulnUntil) return // ignore if invulnerable
      const inflicted = Math.max(0, amount)
      if (inflicted <= 0) return
      h.damage(inflicted)
      const sprite = this.sprite
      if (sprite && sprite.active) {
        const offsetY = -((sprite.displayHeight || 32) * 0.65)
        showDamageNumber(this.scene, inflicted, {
          sprite,
          offsetY,
          color: '#ff5f5f',
          strokeColor: '#2a1212',
          floatDistance: 32,
          fontSize: 20,
        })
      }
      this.invulnUntil = now + this.INVULN_DURATION
      this.invulnFlashTimer = now
      this.invulnFlashOn = false
    }
  }
  heal(amount: number) {
    const h: any = (this as any).health
    if (h && typeof h.heal === 'function') h.heal(amount)
  }
}
