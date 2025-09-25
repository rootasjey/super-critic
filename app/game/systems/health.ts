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
  private container?: Phaser.GameObjects.Container
  private heartImage?: Phaser.GameObjects.Image
  private healthText?: Phaser.GameObjects.Text
  private current = 0
  private max = 0
  private heartBaseScale = 1
  private textBaseScale = 1
  private resetTimer?: Phaser.Time.TimerEvent

  private config = {
    x: 56,
    y: 32,
    scale: 2.2,
    heartHeight: 18,
    textPadding: 12,
    fontSize: 18,
    textColor: '#ffe3d9',
    strokeColor: '#2a1212',
    strokeThickness: 4,
    shadowColor: 'rgba(0, 0, 0, 0.45)',
    shadowOffsetX: 0,
    shadowOffsetY: 3,
    tweenDuration: 200,
    resetDelay: 220,
    textTweenScale: 1.12,
    heartTweenScale: 1.1,
    damageColor: '#ff7575',
    healColor: '#8bffba',
  }

  private static cachedFontFamily?: string

  constructor(private scene: Phaser.Scene) {}

  preload() {
    // Assets are loaded via global ASSETS registry in StageScene.preload
  }

  create(max: number, current: number) {
    this.max = Math.max(1, max)
    this.current = Phaser.Math.Clamp(current, 0, this.max)

    if (this.container) {
      this.killActiveEffects()
      this.container.destroy()
      this.container = undefined
      this.heartImage = undefined
      this.healthText = undefined
    }

    const container = this.scene.add.container(this.config.x, this.config.y)
    container.setScrollFactor(0)
    container.setDepth(1000)
    this.container = container

    const heart = this.scene.add.image(0, 0, 'heart').setOrigin(0, 0)
    const heartScale = this.config.heartHeight / heart.height
    heart.setScale(heartScale)
    this.heartBaseScale = heartScale
    container.add(heart)
    this.heartImage = heart

    const fontFamily = this.resolveUIFont()
    const textY = heart.displayHeight / 2
    const label = this.scene.add.text(
      heart.displayWidth + this.config.textPadding,
      textY,
      this.formatLabel(),
      {
        fontFamily,
        fontSize: `${this.config.fontSize}px`,
        color: this.config.textColor,
      },
    )
    label.setOrigin(0, 0.5)
    label.setStroke(this.config.strokeColor, this.config.strokeThickness)
    label.setShadow(
      this.config.shadowOffsetX,
      this.config.shadowOffsetY,
      this.config.shadowColor,
      0,
      true,
      true,
    )
    container.add(label)
    this.healthText = label
    this.textBaseScale = 1

    container.setScale(this.config.scale)
    this.resetVisualState()
  }

  updateValues(current: number, max: number) {
    let rebuild = false
    const previous = this.current
    if (max !== this.max) {
      this.max = Math.max(1, max)
      rebuild = true
    }
    this.current = Phaser.Math.Clamp(current, 0, this.max)

    if (rebuild) {
      this.create(this.max, this.current)
    } else if (this.healthText) {
      this.healthText.setText(this.formatLabel())
      const delta = this.current - previous
      if (delta !== 0) {
        this.triggerChangeEffect(delta < 0 ? 'damage' : 'heal')
      }
    }
  }

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

  private formatLabel() {
    return `${Math.round(this.current)}/${Math.round(this.max)}`
  }

  private resolveUIFont() {
    if (HealthBarHUD.cachedFontFamily) return HealthBarHUD.cachedFontFamily

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      HealthBarHUD.cachedFontFamily = '"Jersey 20", sans-serif'
      return HealthBarHUD.cachedFontFamily
    }

    const probe = document.createElement('span')
    probe.className = 'font-ui'
    probe.textContent = '0/0'
    probe.style.position = 'fixed'
    probe.style.left = '-9999px'
    probe.style.top = '-9999px'
    probe.style.pointerEvents = 'none'
    document.body.appendChild(probe)

    const fontFamily = getComputedStyle(probe).fontFamily || '"Jersey 20", sans-serif'
    document.body.removeChild(probe)

    HealthBarHUD.cachedFontFamily = fontFamily
    return fontFamily
  }

  private triggerChangeEffect(kind: 'damage' | 'heal') {
    if (!this.healthText) return

    this.scene.tweens.killTweensOf(this.healthText)
    if (this.heartImage) this.scene.tweens.killTweensOf(this.heartImage)
    this.resetTimer?.remove(false)
    this.resetTimer = undefined

    const targetColor = kind === 'damage' ? this.config.damageColor : this.config.healColor
    this.healthText.setColor(targetColor)
    this.healthText.setScale(this.textBaseScale)

    const textTween = this.scene.tweens.add({
      targets: this.healthText,
      scaleX: { from: this.textBaseScale * this.config.textTweenScale, to: this.textBaseScale },
      scaleY: { from: this.textBaseScale * this.config.textTweenScale, to: this.textBaseScale },
      duration: this.config.tweenDuration,
      ease: 'Quad.easeOut',
    })

    if (this.heartImage) {
      this.heartImage.setScale(this.heartBaseScale)
      this.scene.tweens.add({
        targets: this.heartImage,
        scaleX: { from: this.heartBaseScale * this.config.heartTweenScale, to: this.heartBaseScale },
        scaleY: { from: this.heartBaseScale * this.config.heartTweenScale, to: this.heartBaseScale },
        duration: this.config.tweenDuration,
        ease: 'Quad.easeOut',
      })
    }

    this.resetTimer = this.scene.time.delayedCall(this.config.resetDelay + (textTween?.duration ?? 0), () => {
      this.resetVisualState()
    })
  }

  private resetVisualState() {
    this.resetTimer?.remove(false)
    this.resetTimer = undefined
    if (this.healthText) {
      this.scene.tweens.killTweensOf(this.healthText)
      this.healthText.setScale(this.textBaseScale)
      this.healthText.setColor(this.config.textColor)
    }
    if (this.heartImage) {
      this.scene.tweens.killTweensOf(this.heartImage)
      this.heartImage.setScale(this.heartBaseScale)
    }
  }

  private killActiveEffects() {
    this.resetTimer?.remove(false)
    this.resetTimer = undefined
    if (this.healthText) this.scene.tweens.killTweensOf(this.healthText)
    if (this.heartImage) this.scene.tweens.killTweensOf(this.heartImage)
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

