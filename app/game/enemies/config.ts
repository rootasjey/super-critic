export type EnemyKey = 'enemy1' | 'enemy2' | 'enemy3'

export type AnimSpec = { folder: string; frames: number; frameRate: number }
export type EnemyAnimSet = { idle: AnimSpec; run: AnimSpec; attacks: Record<string, AnimSpec>; hit?: AnimSpec }
export type EnemyBodyConfig = { widthFactor: number; heightFactor: number; bottomPad: number }

export type EnemyAttackRange = { min?: number; max: number; vertical?: number }
export type EnemyMeleeHitbox = {
	widthFactor: number
	heightFactor: number
	forwardFactor: number
	verticalOffsetFactor?: number
}
export type EnemyKnockback = { x: number; y?: number }

export type EnemyAttackDefinition = {
	key: string
	animation: string
	range: EnemyAttackRange
	windup: number
	recover: number
	cooldown: number
	damage: number
	hitbox: EnemyMeleeHitbox
	knockback?: EnemyKnockback
	debugColor?: number
}

export type EnemyDefaults = {
	patrolSpeed: number
	patrolRange: number
	aggroRange: number
	verticalAggro: number
	restMin: number
	restMax: number
	canFallOff?: boolean
}

export type EnemyDefinition = {
	key: EnemyKey
	anims: EnemyAnimSet
	body: EnemyBodyConfig
	attacks: EnemyAttackDefinition[]
	defaults?: Partial<EnemyDefaults>
}

export const BASE_DEFAULTS: EnemyDefaults = {
	patrolSpeed: 60,
	patrolRange: 120,
	aggroRange: 130,
	verticalAggro: 72,
	restMin: 0.8,
	restMax: 1.8,
	canFallOff: false,
}

export const ENEMY_DEFS: Record<EnemyKey, EnemyDefinition> = {
	enemy1: {
		key: 'enemy1',
		anims: {
			idle: { folder: '/assets/sprites/enemies/enemy-bald-pirate/idle', frames: 34, frameRate: 12 },
			run: { folder: '/assets/sprites/enemies/enemy-bald-pirate/run', frames: 14, frameRate: 14 },
			attacks: {
				slash: { folder: '/assets/sprites/enemies/enemy-bald-pirate/attack', frames: 12, frameRate: 10 },
			},
			hit: { folder: '/assets/sprites/enemies/enemy-bald-pirate/hit', frames: 8, frameRate: 14 },
		},
		body: { widthFactor: 0.4, heightFactor: 0.9, bottomPad: 2 },
		attacks: [
			{
				key: 'slash',
				animation: 'slash',
				range: { max: 56, vertical: 50 },
				windup: 0.32,
				recover: 0.45,
				cooldown: 1.15,
				damage: 1,
				hitbox: { widthFactor: 0.82, heightFactor: 0.8, forwardFactor: 0.72, verticalOffsetFactor: -0.08 },
				knockback: { x: 160, y: -90 },
				debugColor: 0xff8833,
			},
		],
		defaults: {
			aggroRange: 140,
			verticalAggro: 68,
			patrolSpeed: 65,
		},
	},
	enemy2: {
		key: 'enemy2',
		anims: {
			idle: { folder: '/assets/sprites/enemies/enemy-cucumber/idle', frames: 36, frameRate: 12 },
			run: { folder: '/assets/sprites/enemies/enemy-cucumber/run', frames: 12, frameRate: 14 },
			attacks: {
				slash: { folder: '/assets/sprites/enemies/enemy-cucumber/attack', frames: 11, frameRate: 11 },
				gust: { folder: '/assets/sprites/enemies/enemy-cucumber/blow-the-wick', frames: 11, frameRate: 10 },
			},
			hit: { folder: '/assets/sprites/enemies/enemy-cucumber/hit', frames: 8, frameRate: 14 },
		},
		body: { widthFactor: 0.36, heightFactor: 0.82, bottomPad: 2 },
		attacks: [
			{
				key: 'slash',
				animation: 'slash',
				range: { max: 52, vertical: 52 },
				windup: 0.28,
				recover: 0.42,
				cooldown: 1.05,
				damage: 1,
				hitbox: { widthFactor: 0.78, heightFactor: 0.75, forwardFactor: 0.7, verticalOffsetFactor: -0.05 },
				knockback: { x: 140, y: -80 },
				debugColor: 0x33aaff,
			},
			{
				key: 'gust',
				animation: 'gust',
				range: { min: 70, max: 170, vertical: 60 },
				windup: 0.5,
				recover: 0.6,
				cooldown: 2.2,
				damage: 1,
				hitbox: { widthFactor: 1.6, heightFactor: 0.7, forwardFactor: 1.25, verticalOffsetFactor: -0.12 },
				knockback: { x: 220, y: -40 },
				debugColor: 0x55ffcc,
			},
		],
		defaults: {
			aggroRange: 180,
			verticalAggro: 72,
			patrolSpeed: 70,
			restMin: 0.9,
			restMax: 1.9,
		},
	},
	enemy3: {
		key: 'enemy3',
		anims: {
			idle: { folder: '/assets/sprites/enemies/enemy-big-guy/idle', frames: 38, frameRate: 10 },
			run: { folder: '/assets/sprites/enemies/enemy-big-guy/run', frames: 16, frameRate: 12 },
			attacks: {
				slam: { folder: '/assets/sprites/enemies/enemy-big-guy/attack', frames: 11, frameRate: 8 },
			},
			hit: { folder: '/assets/sprites/enemies/enemy-big-guy/hit', frames: 8, frameRate: 12 },
		},
		body: { widthFactor: 0.46, heightFactor: 0.74, bottomPad: 2 },
		attacks: [
			{
				key: 'slam',
				animation: 'slam',
				range: { max: 66, vertical: 54 },
				windup: 0.42,
				recover: 0.7,
				cooldown: 1.6,
				damage: 2,
				hitbox: { widthFactor: 0.95, heightFactor: 0.88, forwardFactor: 0.62, verticalOffsetFactor: -0.05 },
				knockback: { x: 260, y: -140 },
				debugColor: 0xff3355,
			},
		],
		defaults: {
			patrolSpeed: 52,
			aggroRange: 165,
			verticalAggro: 78,
			restMin: 1.0,
			restMax: 2.1,
		},
	},
}

export function enemyEntries(): Array<[EnemyKey, EnemyDefinition]> {
	return Object.entries(ENEMY_DEFS) as Array<[EnemyKey, EnemyDefinition]>
}
