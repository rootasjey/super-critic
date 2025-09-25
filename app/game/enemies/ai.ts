import Phaser from 'phaser'
import type { Player } from '~/game/Player'

import type {
	EnemyAttackDefinition,
	EnemyDefinition,
	EnemyKey,
	EnemyKnockback,
} from './config'
import { BASE_DEFAULTS, ENEMY_DEFS } from './config'
import { animKey } from './animations'

export type EnemyState = 'idle' | 'run' | 'attack'

type EnemyActiveAttack = {
	def: EnemyAttackDefinition
	phase: 'windup' | 'recover'
	timer: number
}

type EnemyDebugHitbox = {
	rect: Phaser.Geom.Rectangle
	expires: number
	color: number
}

export type EnemyData = {
	sprite: Phaser.Physics.Arcade.Sprite
	key: EnemyKey
	definition: EnemyDefinition
	state: EnemyState
	facing: 1 | -1
	patrolSpeed: number
	patrolRange: number
	baseX: number
	aggroRange: number
	verticalAggro: number
	cooldown: number
	restTimer: number
	restMin: number
	restMax: number
	canFallOff?: boolean
	avoidLedgeTimer?: number
	hurtTimer?: number
	attacks: EnemyAttackDefinition[]
	attackCooldowns: Record<string, number>
	currentAttack?: EnemyActiveAttack
	debugHitbox?: EnemyDebugHitbox
}

function buildDefaultConfig(def: EnemyDefinition) {
	const defaults = def.defaults || {}
	return {
		patrolSpeed: defaults.patrolSpeed ?? BASE_DEFAULTS.patrolSpeed,
		patrolRange: defaults.patrolRange ?? BASE_DEFAULTS.patrolRange,
		aggroRange: defaults.aggroRange ?? BASE_DEFAULTS.aggroRange,
		verticalAggro: defaults.verticalAggro ?? BASE_DEFAULTS.verticalAggro,
		restMin: defaults.restMin ?? BASE_DEFAULTS.restMin,
		restMax: defaults.restMax ?? BASE_DEFAULTS.restMax,
		canFallOff: defaults.canFallOff ?? BASE_DEFAULTS.canFallOff,
	}
}

export function attachEnemyData(sprite: Phaser.Physics.Arcade.Sprite, key: EnemyKey): EnemyData {
	const definition = ENEMY_DEFS[key]
	const { patrolSpeed, patrolRange, aggroRange, verticalAggro, restMin, restMax, canFallOff } = buildDefaultConfig(definition)
	const attackCooldowns: Record<string, number> = {}
	definition.attacks.forEach(att => { attackCooldowns[att.key] = 0 })

	const data: EnemyData = {
		sprite,
		key,
		definition,
		state: 'idle',
		facing: Math.random() > 0.5 ? 1 : -1,
		patrolSpeed,
		patrolRange,
		baseX: sprite.x,
		aggroRange,
		verticalAggro,
		cooldown: 0,
		restTimer: 0,
		restMin,
		restMax,
		canFallOff,
		avoidLedgeTimer: 0,
		attacks: definition.attacks,
		attackCooldowns,
	}
	;(sprite as any).__enemy = data
	return data
}

export function getEnemyData(sprite: Phaser.Physics.Arcade.Sprite): EnemyData | undefined {
	return (sprite as any).__enemy as EnemyData | undefined
}

function playEnemyBaseAnim(data: EnemyData, state: 'idle' | 'run') {
	const key = animKey(data.key, state)
	if (data.sprite.anims.currentAnim?.key !== key) {
		data.sprite.anims.play(key, true)
	}
	data.state = state
}

function playEnemyAttackAnim(data: EnemyData, attackKey: string) {
	const key = animKey(data.key, `attack:${attackKey}`)
	if (data.sprite.anims.currentAnim?.key !== key) {
		data.sprite.anims.play(key, true)
	}
	data.state = 'attack'
}

function hasGroundBelow(scene: Phaser.Scene, rx: number, ry: number, rw = 3, rh = 6): boolean {
	const probe = new Phaser.Geom.Rectangle(rx - rw / 2, ry, rw, rh)
	let hit = false
	scene.physics.world.staticBodies.iterate((b: Phaser.Physics.Arcade.StaticBody) => {
		if (hit || !b || !b.enable) return true
		const rect = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height)
		if (Phaser.Geom.Intersects.RectangleToRectangle(probe, rect)) {
			hit = true
			return false
		}
		return true
	})
	return hit
}

function isLedgeAhead(scene: Phaser.Scene, body: Phaser.Physics.Arcade.Body, facing: 1 | -1): boolean {
	const aheadX = body.center.x + facing * (body.width / 2 + 3)
	const probeY = body.bottom + 1
	const groundThere = hasGroundBelow(scene, aheadX, probeY)
	return !groundThere
}

function reduceTimers(map: Record<string, number> | undefined, dt: number) {
	if (!map) return
	const keys = Object.keys(map)
	for (const key of keys) {
		const current = map[key] ?? 0
		map[key] = Math.max(0, current - dt)
	}
}

function selectEnemyAttack(data: EnemyData, horizontal: number, vertical: number) {
	const candidate = data.attacks
		.filter(att => (data.attackCooldowns[att.key] || 0) <= 0)
		.filter(att => {
			const min = att.range.min ?? 0
			const max = att.range.max
			const v = att.range.vertical ?? Number.POSITIVE_INFINITY
			return horizontal >= min && horizontal <= max && vertical <= v
		})
		.sort((a, b) => (a.range.max || 0) - (b.range.max || 0))
	return candidate[0]
}

function startEnemyAttack(data: EnemyData, attack: EnemyAttackDefinition) {
	const windup = Math.max(0, attack.windup)
	data.currentAttack = {
		def: attack,
		phase: windup > 0 ? 'windup' : 'recover',
		timer: windup > 0 ? windup : Math.max(0, attack.recover),
	}
	data.attackCooldowns[attack.key] = attack.cooldown
	data.cooldown = Math.max(data.cooldown, 0.25)
	playEnemyAttackAnim(data, attack.animation)
	data.sprite.setVelocityX(0)
}

function performMeleeAttack(scene: Phaser.Scene, data: EnemyData, attack: EnemyAttackDefinition, player?: Player) {
	const body = data.sprite.body as Phaser.Physics.Arcade.Body
	if (!body) return
	const width = Math.max(4, body.width * attack.hitbox.widthFactor)
	const height = Math.max(4, body.height * attack.hitbox.heightFactor)
	const centerX = body.center?.x ?? (body.x + body.width / 2)
	const centerY = body.center?.y ?? (body.y + body.height / 2)
	const hitX = centerX + data.facing * (body.width * attack.hitbox.forwardFactor)
	const hitY = centerY + (attack.hitbox.verticalOffsetFactor ?? 0) * body.height
	const rect = new Phaser.Geom.Rectangle(hitX - width / 2, hitY - height / 2, width, height)

	data.debugHitbox = { rect, expires: scene.time.now + 160, color: attack.debugColor ?? 0xff4444 }

	if (!player || !player.sprite) return
	const playerBody = player.sprite.body as Phaser.Physics.Arcade.Body
	if (!playerBody) return
	const playerRect = new Phaser.Geom.Rectangle(playerBody.x, playerBody.y, playerBody.width, playerBody.height)
	if (Phaser.Geom.Intersects.RectangleToRectangle(rect, playerRect)) {
		player.damage(attack.damage)
		if (attack.knockback) {
			player.sprite.setVelocityX(attack.knockback.x * data.facing)
			if (typeof attack.knockback.y === 'number') player.sprite.setVelocityY(attack.knockback.y)
		}
	}
}

export function updateEnemyAI(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite, player?: Player) {
	const d = getEnemyData(sprite)
	if (!d) return
	const body = sprite.body as Phaser.Physics.Arcade.Body
	if (!body) return
	const dt = scene.game.loop.delta / 1000

	d.cooldown = Math.max(0, d.cooldown - dt)
	d.restTimer = Math.max(0, d.restTimer - dt)
	if (d.avoidLedgeTimer) d.avoidLedgeTimer = Math.max(0, (d.avoidLedgeTimer || 0) - dt)
	if (d.hurtTimer) d.hurtTimer = Math.max(0, d.hurtTimer - dt)
	reduceTimers(d.attackCooldowns, dt)

	if (d.hurtTimer && d.hurtTimer > 0) {
		if (d.currentAttack) {
			d.currentAttack = undefined
			playEnemyBaseAnim(d, 'idle')
		}
		sprite.setFlipX(d.facing < 0)
		return
	}

	if (d.currentAttack) {
		const current = d.currentAttack
		sprite.setFlipX(d.facing < 0)
		body.setVelocityX(0)
		current.timer -= dt
		if (current.phase === 'windup' && current.timer <= 0) {
			performMeleeAttack(scene, d, current.def, player)
			current.phase = 'recover'
			current.timer = Math.max(0, current.def.recover)
		} else if (current.phase === 'recover' && current.timer <= 0) {
			d.currentAttack = undefined
			d.cooldown = Math.max(d.cooldown, 0.2)
			playEnemyBaseAnim(d, 'idle')
		}
		return
	}

	if (body.blocked.left) d.facing = 1
	else if (body.blocked.right) d.facing = -1

	const playerSprite = player?.sprite
	let targetX: number | null = null
	if (playerSprite && (d.avoidLedgeTimer || 0) === 0) {
		const playerBody = playerSprite.body as Phaser.Physics.Arcade.Body
		const bodyCenter = body.center ?? new Phaser.Math.Vector2(body.x + body.width / 2, body.y + body.height / 2)
		const targetCenter = playerBody?.center ?? new Phaser.Math.Vector2(playerSprite.x, playerSprite.y)
		const dx = targetCenter.x - bodyCenter.x
		const dy = targetCenter.y - bodyCenter.y
		const withinVertical = Math.abs(dy) <= d.verticalAggro
		const dist = Math.hypot(dx, dy)
		if (withinVertical && dist <= d.aggroRange) targetX = targetCenter.x
	}

	const ledgeAhead = !d.canFallOff && body.onFloor() && isLedgeAhead(scene, body, d.facing)

	if (targetX !== null && playerSprite) {
		const playerBody = playerSprite.body as Phaser.Physics.Arcade.Body
		const bodyCenter = body.center ?? new Phaser.Math.Vector2(body.x + body.width / 2, body.y + body.height / 2)
		const targetCenter = playerBody?.center ?? new Phaser.Math.Vector2(playerSprite.x, playerSprite.y)
		const dx = targetCenter.x - bodyCenter.x
		const dy = targetCenter.y - bodyCenter.y
		if (!ledgeAhead) d.facing = dx >= 0 ? 1 : -1
		const absdx = Math.abs(dx)
		const absdy = Math.abs(dy)
		sprite.setFlipX(d.facing < 0)

		if (ledgeAhead) {
			body.setVelocityX(0)
			playEnemyBaseAnim(d, 'idle')
			if (d.restTimer === 0) {
				d.restTimer = d.restMin + Math.random() * (d.restMax - d.restMin)
				d.facing = d.facing === 1 ? -1 : 1
				d.avoidLedgeTimer = 1.2
			}
			return
		}

		if (d.cooldown <= 0) {
			const attack = selectEnemyAttack(d, absdx, absdy)
			if (attack) {
				startEnemyAttack(d, attack)
				sprite.setFlipX(d.facing < 0)
				return
			}
		}

		body.setVelocityX(d.facing * Math.min(120, absdx))
		playEnemyBaseAnim(d, 'run')
	} else {
		const left = d.baseX - d.patrolRange
		const right = d.baseX + d.patrolRange

		if (d.restTimer > 0) {
			body.setVelocityX(0)
			playEnemyBaseAnim(d, 'idle')
			sprite.setFlipX(d.facing < 0)
			return
		}

		const nearLeftEdge = sprite.x <= left + 2
		const nearRightEdge = sprite.x >= right - 2
		const hitWall = body.blocked.left || body.blocked.right
		if ((d.facing < 0 && nearLeftEdge) || (d.facing > 0 && nearRightEdge) || hitWall || ledgeAhead) {
			body.setVelocityX(0)
			playEnemyBaseAnim(d, 'idle')
			sprite.setFlipX(d.facing < 0)
			d.restTimer = d.restMin + Math.random() * (d.restMax - d.restMin)
			d.facing = d.facing === 1 ? -1 : 1
			if (ledgeAhead) {
				sprite.setX(sprite.x + (d.facing * 2))
				d.avoidLedgeTimer = Math.max(d.avoidLedgeTimer || 0, 0.5)
			}
			return
		}

		body.setVelocityX(d.facing * d.patrolSpeed)
		playEnemyBaseAnim(d, 'run')
		sprite.setFlipX(d.facing < 0)
	}
}

export type Knockback = EnemyKnockback

export function applyEnemyHit(
	scene: Phaser.Scene,
	enemy: Phaser.Physics.Arcade.Sprite,
	knock: Knockback,
	dir: 1 | -1,
	stagger = 0.3,
) {
	const data = getEnemyData(enemy)
	const body = enemy.body as Phaser.Physics.Arcade.Body | null
	if (!body) return
	try {
		enemy.setTintFill(0xff4444)
		scene.time.delayedCall(80, () => enemy.clearTint())
	} catch {}

	const key: EnemyKey | undefined = (data?.key || undefined) as any
	if (key) {
		const hitAnimKey = animKey(key, 'hit')
		if (scene.anims.exists(hitAnimKey)) {
			try { enemy.anims.play(hitAnimKey, true) } catch {}
		}
	}

	try {
		body.setVelocityX((knock.x || 0) * dir)
		if (typeof knock.y === 'number') body.setVelocityY(knock.y)
	} catch {}

	if (data) {
		data.hurtTimer = Math.max(stagger, 0)
		data.cooldown = Math.max(data.cooldown, 0.5)
	}
}
