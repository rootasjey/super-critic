#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// Categorize normalized sprite folders into logical groups
// Groups under /public/assets/sprites:
// - enemies
// - props
// - ui
// - particles
// This script moves entire folders (already kebab-cased) and records a mapping for revert.

const ROOT = process.cwd()
const SPRITES = path.join(ROOT, 'public/assets/sprites')
const MAP_DIR = path.join(ROOT, 'tools/.category-maps')

function ensureDir(p){ fs.mkdirSync(p, { recursive: true }) }

const PLAN = {
  enemies: [
    'enemy-bald-pirate', 'enemy-cucumber', 'enemy-big-guy', 'enemy-cannon'
  ],
  props: [
    'door', 'barrel', 'table', 'chair', 'candle', 'small-chain', 'big-chain', 'other-objects', 'window-light'
  ],
  ui: [
    'health-bar', 'heart', 'bomb-bar', 'interrogation-dialog', 'exclamation-dialog'
  ],
  particles: [
    'run-particles', 'jump-particles', 'fall-particles', 'bomb'
  ],
}

function buildMoves() {
  const moves = []
  for (const [cat, names] of Object.entries(PLAN)) {
    for (const name of names) {
      const src = path.join(SPRITES, name)
      if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) continue
      const dst = path.join(SPRITES, cat, name)
      if (src === dst) continue
      moves.push({ from: src, to: dst })
    }
  }
  return moves
}

function writeMap(moves) {
  ensureDir(MAP_DIR)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(MAP_DIR, `cat-map-${stamp}.json`)
  fs.writeFileSync(file, JSON.stringify(moves, null, 2))
  return file
}

function applyMoves(moves) {
  for (const { from, to } of moves) {
    ensureDir(path.dirname(to))
    try { fs.renameSync(from, to) } catch (e) {
      if (e && e.code === 'EXDEV') {
        // cross-device fallback
        fs.cpSync(from, to, { recursive: true })
        fs.rmSync(from, { recursive: true, force: true })
      } else { throw e }
    }
  }
}

function revert(file) {
  const moves = JSON.parse(fs.readFileSync(file, 'utf-8'))
  for (const { from, to } of moves) {
    if (fs.existsSync(to)) {
      ensureDir(path.dirname(from))
      try { fs.renameSync(to, from) } catch (e) {
        fs.cpSync(to, from, { recursive: true })
        fs.rmSync(to, { recursive: true, force: true })
      }
    }
  }
}

function latestMap() {
  if (!fs.existsSync(MAP_DIR)) return null
  const files = fs.readdirSync(MAP_DIR).filter(f => f.startsWith('cat-map-'))
  if (!files.length) return null
  files.sort()
  return path.join(MAP_DIR, files[files.length - 1])
}

function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has('--revert')) {
    const m = latestMap()
    if (!m) { console.log('No category mapping to revert.'); return }
    console.log('Reverting from', path.relative(ROOT, m))
    revert(m)
    console.log('Done.')
    return
  }

  const moves = buildMoves()
  if (!moves.length) { console.log('Nothing to categorize.'); return }
  console.log('Planned category moves:')
  for (const m of moves) console.log('-', path.relative(ROOT, m.from), '=>', path.relative(ROOT, m.to))
  const map = writeMap(moves)
  console.log('Map written to', path.relative(ROOT, map))

  if (!args.has('--apply')) { console.log('Dry-run complete. Re-run with --apply to apply.'); return }
  console.log('Applying category moves...')
  applyMoves(moves)
  console.log('Done.')
}

main()
