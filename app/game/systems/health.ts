import Phaser from 'phaser'
import type { Player } from '~/game/Player'

export interface HealthConfig {
  max: number
  initial?: number
}

export interface HealthEvents extends Phaser.Events.EventEmitter {
  on(event: 'health-changed', fn: (current: number, max: number) => void, context?: any): this
  on(event: 'player-died', fn: () => void, context?: any): this
  emit(event: 'health-changed', current: number, max: number): boolean
  emit(event: 'player-died'): boolean
}

export class HealthComponent {
  private _current: number
  private _max: number
  private events: HealthEvents
  private dead = false

  constructor(private owner: Player, cfg: HealthConfig) {
    this._max = Math.max(1, Math.round(cfg.max))
    this._current = Math.min(this._max, Math.max(0, Math.round(cfg.initial ?? cfg.max)))
    this.events = new Phaser.Events.EventEmitter() as HealthEvents
  }

  get current() { return this._current }
  get max() { return this._max }
  get isDead() { return this.dead }
  get emitter() { return this.events }

  damage(amount: number) {
    if (this.dead) return
    const v = Math.max(0, this._current - Math.max(0, Math.round(amount)))
    if (v !== this._current) {
      this._current = v
      this.events.emit('health-changed', this._current, this._max)
      if (this._current <= 0) {
        this.dead = true
        this.events.emit('player-died')
        // simple death animation if available
        try {
          const key = this.owner.sprite?.anims?.currentAnim?.key || ''
          if (!key.includes('dead')) {
            if (this.owner.scene.anims.exists('player_dead_hit')) this.owner.sprite.play('player_dead_hit')
          }
        } catch {}
      }
    }
  }

  heal(amount: number) {
    if (this.dead) return
    const v = Math.min(this._max, this._current + Math.max(0, Math.round(amount)))
    if (v !== this._current) {
      this._current = v
      this.events.emit('health-changed', this._current, this._max)
    }
  }

  setMax(max: number, fill = true) {
    this._max = Math.max(1, Math.round(max))
    if (fill) this._current = this._max
    this.events.emit('health-changed', this._current, this._max)
  }
}

// HUD ----------------------------------------------------------------------

export class HealthBarHUD {
  private container!: Phaser.GameObjects.Container
  private fillImage?: Phaser.GameObjects.Image
  private midBar?: Phaser.GameObjects.Image
  private startCap?: Phaser.GameObjects.Image
  private endCap?: Phaser.GameObjects.Image
  private fillMaskWidth = 0
  // Refined proportions for better fit aiming at reference.png style
  private config = {
    x: 56,
    y: 32,
    barHeight: 42,      // base pixel bar height before global scale (larger)
    fillInsetY: 18,     // vertical padding inside bar
    fillInsetX: 12,     // horizontal padding from start cap center to fill start
    midBaseWidth: 100,  // wider mid section
    scale: 2.2,         // overall scale applied to whole HUD container (bigger on screen)
    fillBorderPad: 1.5, // extra shrink so red fill never touches border lines
    // Optional overrides for inner fill geometry (container-space coordinates)
    fillPosX: 22,
    fillPosY: 18.7,
    fillHeight: 0,
  }
  private current = 0
  private max = 0

  constructor(private scene: Phaser.Scene) {}

  preload() {
    // Assets are loaded via global ASSETS registry in StageScene.preload
  }

  create(max: number, current: number) {
    this.max = max
    this.current = current
    if (this.container) this.container.destroy()
    const healthContainer = this.scene.add.container(this.config.x, this.config.y)
    this.container = healthContainer
    healthContainer.setScrollFactor(0) // fixed to camera

    // Start cap (keep original pixel size; barHeight used to compute scaleY if asset height differs)
    const startCap = this.scene.add.image(0, 0, 'health_bar_start').setOrigin(0, 0)
    const scaleY = this.config.barHeight / startCap.height
    startCap.setScale(scaleY) // uniform to preserve aspect
    healthContainer.add(startCap)
    this.startCap = startCap

    // Middle bar: tile the middle by scaling X only (keep pixel ratio)
    const mid = this.scene.add.image(startCap.displayWidth, 0, 'health_bar_middle').setOrigin(0, 0)
    mid.setScale((this.config.midBaseWidth / mid.width), scaleY)
    healthContainer.add(mid)
    this.midBar = mid

    // End cap
    const end = this.scene.add.image(startCap.displayWidth + mid.displayWidth, 0, 'health_bar_end').setOrigin(0, 0)
    end.setScale(scaleY)
    healthContainer.add(end)
    this.endCap = end

  // Fill (continuous) inside middle bar
  const barPixelWidth = mid.displayWidth
  const defaultLeft = startCap.displayWidth + this.config.fillInsetX
  const defaultRight = startCap.displayWidth + barPixelWidth - this.config.fillInsetX
  const fillX = (this.config.fillPosX ?? defaultLeft)
  // ensure width computed to the right inner edge for perfect alignment
  const innerWidth = Math.max(2, Math.round(defaultRight - fillX))
  // default height derived from bar with padding unless overridden
  const defaultHeight = Math.max(2, Math.round((startCap.height * scaleY) - (this.config.fillInsetY * 2) - (this.config.fillBorderPad * 2)))
  const targetHeight = Math.max(2, this.config.fillHeight ?? defaultHeight)
  this.fillMaskWidth = innerWidth
  const fillY = (this.config.fillPosY ?? (this.config.fillInsetY + this.config.fillBorderPad))
  const fill = this.scene.add.image(fillX, fillY, 'health_bar_fill_red').setOrigin(0, 0)
  // Scale fill proportionally instead of stretching separately: use scale to reach targetHeight
  const fillScaleY = targetHeight / fill.height
  fill.setScale( (innerWidth / fill.width), fillScaleY )
    // Add fill below mid/end caps so borders render on top
    healthContainer.addAt(fill, 2) // index 0=startCap, 1=mid, 2=fill, rest will shift
    this.fillImage = fill
    this.updateFillCrop()

    // Apply overall HUD scale after layout so pixel math above uses base sizes
    healthContainer.setScale(this.config.scale)
  }

  private updateFillCrop() {
    if (!this.fillImage) return
    const pct = this.max > 0 ? (this.current / this.max) : 0
    const w = Math.max(0, Math.round(this.fillMaskWidth * pct))
    const texW = this.fillImage.texture.getSourceImage().width
    const texH = this.fillImage.texture.getSourceImage().height
    const cropW = (w / this.fillMaskWidth) * texW
    this.fillImage.setCrop(0, 0, cropW, texH)
  }

  updateValues(current: number, max: number) {
    let rebuild = false
    if (max !== this.max) { this.max = max; rebuild = true }
    this.current = Phaser.Math.Clamp(current, 0, this.max)
    if (rebuild) this.create(this.max, this.current)
    else this.updateFillCrop()
  }

  // Runtime adjustments --------------------------------------------------
  setHudScale(scale: number) {
    if (!this.container) return
    this.config.scale = scale
    this.container.setScale(scale)
  }

  setHudPosition(x: number, y: number) {
    if (!this.container) return
    this.config.x = x
    this.config.y = y
    this.container.setPosition(x, y)
  }

  // Exposed controls for fill geometry (container-space)
  setFillPosition(x: number, y: number) {
    this.config.fillPosX = x
    this.config.fillPosY = y
    this.relayoutFillFromConfig()
  }

  setFillHeight(height: number) {
    this.config.fillHeight = Math.max(2, height)
    this.relayoutFillFromConfig()
  }

  private relayoutFillFromConfig() {
    if (!this.container || !this.fillImage || !this.startCap || !this.midBar) return
    const startCap = this.startCap
    const mid = this.midBar
    // current scaleY used to size outlines
    const scaleY = startCap.scaleY || 1
    const barPixelWidth = mid.displayWidth
    const defaultLeft = startCap.displayWidth + this.config.fillInsetX
    const defaultRight = startCap.displayWidth + barPixelWidth - this.config.fillInsetX
    const fillX = (this.config.fillPosX ?? defaultLeft)
    const innerWidth = Math.max(2, Math.round(defaultRight - fillX))
    const defaultHeight = Math.max(2, Math.round((startCap.height * scaleY) - (this.config.fillInsetY * 2) - (this.config.fillBorderPad * 2)))
    const targetHeight = Math.max(2, this.config.fillHeight ?? defaultHeight)
    const fillY = (this.config.fillPosY ?? (this.config.fillInsetY + this.config.fillBorderPad))
    this.fillMaskWidth = innerWidth
    this.fillImage.setPosition(fillX, fillY)
    // update scales to match new geometry
    const sx = innerWidth / this.fillImage.width
    const sy = targetHeight / this.fillImage.height
    this.fillImage.setScale(sx, sy)
    this.updateFillCrop()
  }
}

export function attachHealthToPlayer(player: Player, config: HealthConfig = { max: 5 }) {
  const hc = new HealthComponent(player, config)
  ;(player as any).health = hc
  return hc
}

export function getPlayerHealth(player: Player): HealthComponent | undefined {
  return (player as any).health as HealthComponent | undefined
}

