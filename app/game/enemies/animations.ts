import Phaser from 'phaser'
import type { AnimSpec, EnemyDefinition, EnemyKey } from './config'
import { enemyEntries } from './config'

export function folderBaseName(path: string) {
	const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
	const idx = trimmed.lastIndexOf('/')
	return idx >= 0 ? trimmed.slice(idx + 1) : trimmed
}

export function frameKey(enemyKey: EnemyKey, animKey: string, frameIndex: number) {
	return `${enemyKey}_${animKey}_${frameIndex}`
}

export function animKey(enemyKey: EnemyKey, anim: string) {
	return `enemy:${enemyKey}:${anim}`
}

export function preloadAnimFrames(scene: Phaser.Scene, enemyKey: EnemyKey, animName: string, spec: AnimSpec) {
	const base = folderBaseName(spec.folder)
	for (let i = 1; i <= spec.frames; i++) {
		const key = frameKey(enemyKey, animName, i)
		if (scene.textures.exists(key)) continue
		const ii = String(i).padStart(2, '0')
		const url = `${spec.folder}/${base}-${ii}.png`
		scene.load.image(key, url)
	}
}

export function ensureAnimation(
	scene: Phaser.Scene,
	enemyKey: EnemyKey,
	animName: string,
	spec: AnimSpec,
	repeat: number,
	alias?: string,
) {
	const key = animKey(enemyKey, alias ?? animName)
	if (scene.anims.exists(key)) return
	const frames = Array.from({ length: spec.frames }, (_, idx) => ({ key: frameKey(enemyKey, animName, idx + 1) }))
	scene.anims.create({ key, frames, frameRate: spec.frameRate, repeat })
}

export function preloadEnemyIdleFrames(scene: Phaser.Scene) {
	for (const [key, def] of enemyEntries()) {
		preloadAnimFrames(scene, key, 'idle', def.anims.idle)
	}
}

export function preloadEnemyRunAttackFrames(scene: Phaser.Scene) {
	for (const [key, def] of enemyEntries()) {
		preloadAnimFrames(scene, key, 'run', def.anims.run)
		if (def.anims.hit) preloadAnimFrames(scene, key, 'hit', def.anims.hit)
		if (def.anims.death) preloadAnimFrames(scene, key, 'death', def.anims.death)
		for (const [attackKey, spec] of Object.entries(def.anims.attacks)) {
			preloadAnimFrames(scene, key, `attack_${attackKey}`, spec)
		}
	}
}

export function ensureEnemyIdleAnims(scene: Phaser.Scene) {
	for (const [key, def] of enemyEntries()) {
		ensureAnimation(scene, key, 'idle', def.anims.idle, -1)
	}
}

export function ensureEnemyRunAttackAnims(scene: Phaser.Scene) {
	for (const [key, def] of enemyEntries()) {
		ensureAnimation(scene, key, 'run', def.anims.run, -1)
		if (def.anims.hit) ensureAnimation(scene, key, 'hit', def.anims.hit, 0)
		if (def.anims.death) ensureAnimation(scene, key, 'death', def.anims.death, 0)
		for (const [attackKey, spec] of Object.entries(def.anims.attacks)) {
			ensureAnimation(scene, key, `attack_${attackKey}`, spec, 0, `attack:${attackKey}`)
		}
	}
}

export function getEnemyDefinition(key: EnemyKey): EnemyDefinition {
	const defs = enemyEntries()
	const found = defs.find(([name]) => name === key)
	if (!found) throw new Error(`Unknown enemy key: ${key}`)
	return found[1]
}
