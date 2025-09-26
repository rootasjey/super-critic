import Phaser from 'phaser'

export type DamageNumberOptions = {
  sprite?: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite
  x?: number
  y?: number
  offsetY?: number
  color?: string
  strokeColor?: string
  fontSize?: number
  duration?: number
  floatDistance?: number
  critical?: boolean
}

function resolvePosition(opts: DamageNumberOptions) {
  const sprite = opts.sprite
  let x = opts.x ?? sprite?.x ?? 0
  let y = opts.y

  if (typeof y !== 'number' && sprite) {
    const anyBody = sprite.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | undefined
    if (anyBody && 'top' in anyBody) {
      y = anyBody.top
    } else {
      y = sprite.y
    }
  }

  if (typeof y !== 'number') y = 0
  const offsetY = opts.offsetY ?? -20
  return { x, y: y + offsetY }
}

export function showDamageNumber(scene: Phaser.Scene, rawAmount: number, opts: DamageNumberOptions = {}) {
  if (!scene || typeof rawAmount !== 'number' || !Number.isFinite(rawAmount)) return
  const amount = Math.max(0, rawAmount)
  if (amount <= 0) return

  const fontSize = opts.fontSize ?? 18
  const duration = opts.duration ?? 420
  const floatDistance = opts.floatDistance ?? 26
  const color = opts.color ?? '#134686'
  const strokeColor = opts.strokeColor ?? '#2a1212'

  const { x, y } = resolvePosition(opts)
  const jitterX = Phaser.Math.Between(-4, 4)
  const displayValue = Number.isInteger(amount) ? `${Math.round(amount)}` : amount.toFixed(1)

  const text = scene.add.text(x + jitterX, y, displayValue, {
    fontFamily: '"Jersey 20", sans-serif',
    fontSize: `${fontSize}px`,
    color,
  })
  text.setOrigin(0.5)
  text.setDepth(3000)
  text.setAlpha(0.94)
  text.setStroke(strokeColor, 4)
  text.setShadow(0, 2, 'rgba(0,0,0,0.45)', 0, true, true)

  if (opts.critical) {
    text.setFontSize(fontSize * 1.2)
    text.setShadow(0, 2, 'rgba(0,0,0,0.85)', 4, true, true)
  }

  const scaleStart = opts.critical ? 5.00 : 3
  const scaleEnd = 1
  text.setScale(scaleStart)

  // Add "CRIT!" text for critical hits
  let critText: Phaser.GameObjects.Text | undefined
  if (opts.critical) {
    critText = scene.add.text(x + jitterX + 15, y - 48, 'CRIT!', {
      fontFamily: '"Jersey 20", sans-serif',
      fontSize: `${Math.round(fontSize * 0.7)}px`,
      color: '#FF0066',
    })
    critText.setOrigin(0.5)
    critText.setDepth(3001)
    critText.setAlpha(0.95)
    critText.setStroke('#E45A92', 3)
    critText.setShadow(0, 1, 'rgba(0,0,0,0.9)', 2, true, true)
    critText.setScale(2.5)
  }

  scene.tweens.add({
    targets: text,
    y: y - floatDistance,
    scaleX: scaleEnd,
    scaleY: scaleEnd,
    alpha: 0,
    duration,
    ease: 'Quad.easeOut',
    onComplete: () => {
      text.destroy()
    },
  })

  // Animate the CRIT! text separately if it exists
  if (critText) {
    scene.tweens.add({
      targets: critText,
      y: y - floatDistance - 8,
      scaleX: 0.8,
      scaleY: 0.8,
      alpha: 0,
      duration: duration * 1.1,
      ease: 'Back.easeOut',
      onComplete: () => {
        critText!.destroy()
      },
    })
  }

  scene.time.delayedCall(duration + 60, () => {
    if (text.active) text.destroy()
    if (critText && critText.active) critText.destroy()
  })
}
