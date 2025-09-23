#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// Quick existence checker for asset paths referenced in code
// - Scans app/game/config/assets.ts for '/assets/...' strings
// - Scans app/game/systems/objects.ts enemy anim folders and checks for '-01.png'
// - Verifies the files exist under the 'public' folder

const ROOT = process.cwd()
const PUBLIC = path.join(ROOT, 'public')

function fileExists(relUrl) {
  const p = path.join(PUBLIC, relUrl.replace(/^\/+/, ''))
  return fs.existsSync(p)
}

function collectAssetUrlsFromFile(absFile) {
  const src = fs.readFileSync(absFile, 'utf-8')
  const urls = new Set()
  const re = /['"](\/assets\/[^'"\n]+)['"]/g
  let m
  while ((m = re.exec(src))) {
    urls.add(m[1])
  }
  return Array.from(urls)
}

function collectEnemyFolders(absFile) {
  const src = fs.readFileSync(absFile, 'utf-8')
  const folders = []
  const re = /folder:\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(src))) {
    folders.push(m[1])
  }
  return folders
}

function main() {
  const imageConfig = path.join(ROOT, 'app/game/config/assets.ts')
  const objectsFile = path.join(ROOT, 'app/game/systems/objects.ts')
  const missing = []
  const checked = []

  if (fs.existsSync(imageConfig)) {
    const urls = collectAssetUrlsFromFile(imageConfig)
    for (const u of urls) {
      checked.push(u)
      if (!fileExists(u)) missing.push(u)
    }
  }

  if (fs.existsSync(objectsFile)) {
    const folders = collectEnemyFolders(objectsFile)
    for (const f of folders) {
      const u = `${f}/${path.basename(f)}-01.png`
      checked.push(u)
      if (!fileExists(u)) missing.push(u)
    }
  }

  if (missing.length) {
    console.log('Missing assets:')
    for (const m of missing) console.log('-', m)
    process.exitCode = 1
  } else {
    console.log(`All ${checked.length} referenced assets found.`)
  }
}

main()
