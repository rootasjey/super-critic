#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * Asset renamer (safe, incremental)
 * - Default scope: public/assets/sprites/player/**
 * - Modes: dry-run, copy (default), move, link
 * - Generates mapping JSON for revert
 * - Filters: --include, --exclude (substring match)
 */

const ROOT = process.cwd()
const DEFAULT_ROOTS = [
  path.join(ROOT, 'public/assets/sprites/player'),
]
const MAPPING_DIR = path.join(ROOT, 'tools/.rename-maps')

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function toKebabBase(name) {
  // Drop common numeric prefixes like `01-` at start
  let n = name.replace(/^\d+[-_\s]*/, '')
  // Replace separators with space
  n = n.replace(/[._]+/g, ' ')
  // Expand plus to word for cleaner URLs
  n = n.replace(/[+]/g, ' plus ')
  // Normalize camelCase to spaces
  n = n.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  // Collapse whitespace and separators
  n = n.replace(/[-/]+/g, ' ')
  n = n.replace(/\s+/g, ' ').trim()
  // Lowercase and join with hyphen
  n = n.toLowerCase().replace(/\s+/g, '-')
  return n
}

function pad2(n) {
  const s = String(n)
  return s.length === 1 ? '0' + s : s
}

function normalizeFileName(file, parentHint) {
  const ext = path.extname(file)
  const base = path.basename(file, ext)
  // Skip dotfiles entirely (handled by caller)
  if (base.startsWith('.')) return null

  // If purely numeric base (e.g., "1")
  if (/^\d+$/.test(base)) {
    if (parentHint) return `${parentHint}-${pad2(base)}${ext.toLowerCase()}`
    return `${pad2(base)}${ext.toLowerCase()}`
  }

  let b = toKebabBase(base)
  // Try to extract trailing frame number and prefix with parent folder name
  const m = b.match(/^(.*?)-(\d+)$/)
  if (m && parentHint) {
    return `${parentHint}-${pad2(m[2])}${ext.toLowerCase()}`
  }
  // Single-digit suffix padding: foo-1 -> foo-01
  b = b.replace(/-(\d)$/,'-0$1')
  // If parent hint exists and name doesn't already start with it, prefix
  if (parentHint && !b.startsWith(parentHint + '-')) {
    return `${parentHint}-${b}${ext.toLowerCase()}`
  }
  return b + ext.toLowerCase()
}

function normalizePath(parts) {
  const out = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    const ext = path.extname(p)
    if (!ext) {
      // directory
      if (p.startsWith('.')) continue // skip hidden dirs
      out.push(toKebabBase(p))
    } else {
      // file
      const parent = out.length ? out[out.length - 1] : null
      if (path.basename(p).startsWith('.')) continue // skip dotfiles
      const nn = normalizeFileName(p, parent)
      if (nn) out.push(nn)
    }
  }
  return out
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, files)
    else files.push(p)
  }
  return files
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    apply: false,
    mode: 'copy', // copy | move | link
    include: [],
    exclude: [],
    roots: [...DEFAULT_ROOTS],
    revert: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--apply') args.apply = true
    else if (a === '--revert') args.revert = true
    else if (a === '--mode') args.mode = argv[++i] || 'copy'
    else if (a === '--root') args.roots.push(path.resolve(argv[++i]))
    else if (a === '--include') args.include.push(argv[++i])
    else if (a === '--exclude') args.exclude.push(argv[++i])
  }
  return args
}

function shouldKeep(file, include, exclude) {
  const s = file
  if (include.length && !include.some(k => s.includes(k))) return false
  if (exclude.length && exclude.some(k => s.includes(k))) return false
  return true
}

function buildPlan(roots, include, exclude) {
  const plan = []
  for (const r of roots) {
    const files = walk(r)
    for (const f of files) {
      // Skip dotfiles early
      if (path.basename(f).startsWith('.')) continue
      if (!shouldKeep(f, include, exclude)) continue
      const rel = path.relative(ROOT, f)
      const parts = rel.split(path.sep)
      const idx = parts.indexOf('public')
      if (idx === -1) continue
      const underPublic = parts.slice(idx + 1)
      const normalized = normalizePath(underPublic)
      if (!normalized.length) continue
      const outRel = path.join('public', ...normalized)
      const outAbs = path.join(ROOT, outRel)
      if (path.join(ROOT, rel) === outAbs) continue // already normalized
      plan.push({ from: path.join(ROOT, rel), to: outAbs })
    }
  }
  return plan
}

function writeMapping(plan) {
  ensureDir(MAPPING_DIR)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(MAPPING_DIR, `mapping-${stamp}.json`)
  fs.writeFileSync(file, JSON.stringify(plan, null, 2))
  return file
}

function findLatestMapping() {
  if (!fs.existsSync(MAPPING_DIR)) return null
  const files = fs.readdirSync(MAPPING_DIR).filter(f => f.startsWith('mapping-') && f.endsWith('.json'))
  if (!files.length) return null
  files.sort()
  return path.join(MAPPING_DIR, files[files.length - 1])
}

function applyPlan(plan, mode) {
  for (const { from, to } of plan) {
    ensureDir(path.dirname(to))
    if (mode === 'copy') {
      if (!fs.existsSync(to)) fs.copyFileSync(from, to)
    } else if (mode === 'move') {
      if (fs.existsSync(to)) fs.unlinkSync(to)
      fs.renameSync(from, to)
    } else if (mode === 'link') {
      try { fs.linkSync(from, to) } catch { fs.copyFileSync(from, to) }
    } else {
      throw new Error(`Unknown mode: ${mode}`)
    }
  }
}

function revertFrom(mappingPath) {
  const plan = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'))
  for (const { from, to } of plan) {
    if (fs.existsSync(to)) {
      ensureDir(path.dirname(from))
      try { fs.renameSync(to, from) } catch {
        fs.copyFileSync(to, from)
        fs.unlinkSync(to)
      }
    }
  }
}

function main() {
  const args = parseArgs(process.argv)

  if (args.revert) {
    const latest = findLatestMapping()
    if (!latest) {
      console.log('No mapping found to revert.')
      process.exit(0)
    }
    console.log('Reverting from', path.relative(ROOT, latest))
    revertFrom(latest)
    console.log('Done.')
    return
  }

  const plan = buildPlan(args.roots, args.include, args.exclude)

  if (!plan.length) {
    console.log('Nothing to rename. Paths may already be normalized.')
    return
  }

  console.log('Planned changes:')
  for (const { from, to } of plan) {
    console.log('-', path.relative(ROOT, from), '=>', path.relative(ROOT, to))
  }
  const mapPath = writeMapping(plan)
  console.log('Mapping written to', path.relative(ROOT, mapPath))

  if (!args.apply) {
    console.log('Dry-run complete. Re-run with --apply to proceed.')
    return
  }

  console.log(`Applying (${args.mode})...`)
  applyPlan(plan, args.mode)
  console.log('Done.')
}

main()
