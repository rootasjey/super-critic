import Phaser from 'phaser'

import type { EnemyBodyConfig, EnemyKey } from './config'
import { animKey } from './animations'
import { attachEnemyData } from './ai'

function syncEnemyBody(sprite: Phaser.Physics.Arcade.Sprite, cfg: EnemyBodyConfig) {
	const body = sprite.body as Phaser.Physics.Arcade.Body | null
	if (!body) return
	const fw = Math.max(1, sprite.displayWidth || sprite.width || 0)
	const fh = Math.max(1, sprite.displayHeight || sprite.height || 0)
	if (!fw || !fh) return
	const bw = Math.max(1, Math.round(fw * cfg.widthFactor))
	const bh = Math.max(1, Math.round(fh * cfg.heightFactor))
	const offX = Math.round((fw - bw) / 2)
	const offY = Math.round(fh - bh - cfg.bottomPad)
	body.setSize(bw, bh, false)
	body.setOffset(offX, offY)
}

function resolveEnemyKey(obj: any): EnemyKey {
	const name = (obj?.name || '').toLowerCase()
	if (name === 'enemy1' || name === 'enemy2' || name === 'enemy3') return name as EnemyKey
	return 'enemy1'
}

function applyOptionalOverrides(obj: any, data: ReturnType<typeof attachEnemyData>) {
	try {
		const props = Array.isArray(obj.properties) ? obj.properties : []
		const toKey = (s: string) => (s || '').toLowerCase().replace(/[_\-]/g, '')
		const findProp = (...names: string[]) => {
			const set = names.map(toKey)
			return props.find((p: any) => set.includes(toKey(p?.name || '')))
		}
		const numVal = (p: any): number | undefined => {
			if (!p) return undefined
			const v = p.value
			if (typeof v === 'number') return v
			if (typeof v === 'string') { const f = parseFloat(v); return Number.isFinite(f) ? f : undefined }
			return undefined
		}
		const boolVal = (p: any): boolean | undefined => {
			if (!p) return undefined
			const v = p.value
			if (typeof v === 'boolean') return v
			if (typeof v === 'string') return v.toLowerCase() === 'true'
			return undefined
		}

		const pFall = findProp('canFallOff', 'can_fall_off', 'can-fall-off', 'canfalloff')
		const pAggro = findProp('aggroRange', 'aggro_range', 'aggro-range', 'aggrorange')
		const pVert = findProp('verticalAggro', 'vertical_aggro', 'vertical-aggro', 'verticalaggro', 'aggroVertical')
		const pPatrolRange = findProp('patrolRange', 'patrol_range', 'patrol-range', 'patrolrange')
		const pPatrolSpeed = findProp('patrolSpeed', 'patrol_speed', 'patrol-speed', 'patrolspeed')

		const b = boolVal(pFall); if (typeof b === 'boolean') data.canFallOff = b
		const a = numVal(pAggro); if (typeof a === 'number') data.aggroRange = a
		const v = numVal(pVert); if (typeof v === 'number') data.verticalAggro = v
		const pr = numVal(pPatrolRange); if (typeof pr === 'number') data.patrolRange = pr
		const ps = numVal(pPatrolSpeed); if (typeof ps === 'number') data.patrolSpeed = ps
	} catch {}
}

export function placeEnemies(
	scene: Phaser.Scene,
	map: Phaser.Tilemaps.Tilemap,
	solids: Phaser.Physics.Arcade.StaticGroup,
) {
	const enemiesLayer = map.getObjectLayer('ennemies')
	const enemiesGroup = scene.physics.add.group()

	if (enemiesLayer && enemiesLayer.objects) {
		enemiesLayer.objects.forEach((obj: any) => {
			const ox = obj.x || 0
			const oy = (obj.y || 0) - (obj.height || 0)
			const key = resolveEnemyKey(obj)
			const enemy = enemiesGroup.create(ox, oy, key) as Phaser.Physics.Arcade.Sprite
			enemy.setCollideWorldBounds(true)
			enemy.setBounce(0.05)
			const body = enemy.body as Phaser.Physics.Arcade.Body
			body.setMaxVelocity(200, 1000)
			body.setDrag(200, 0)
			const data = attachEnemyData(enemy, key)
			applyOptionalOverrides(obj, data)

			const idleKey = animKey(key, 'idle')
			if (scene.anims.exists(idleKey)) enemy.anims.play(idleKey, true)

			const cfg: EnemyBodyConfig | undefined = data.definition.body
			if (cfg) {
				enemy.on(Phaser.Animations.Events.ANIMATION_UPDATE, () => syncEnemyBody(enemy, cfg))
				scene.time.delayedCall(0, () => syncEnemyBody(enemy, cfg))
			}
			enemy.setDepth(1)
		})
		scene.physics.add.collider(enemiesGroup, solids)
	}

	return enemiesGroup
}
