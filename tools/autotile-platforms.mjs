#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const filePath = path.join(root, 'public/assets/tilemaps/stage_tiled.json')

const LEFT = 23
const MID = 24
const RIGHT = 29

function autotilePlatforms(layer, width, height) {
  const data = layer.data.slice() // copy
  // Build a top-surface mask: tile present and above is empty/out-of-bounds
  const topMask = new Array(width * height).fill(false)
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const i = r * width + c
      const here = data[i] !== 0
      const aboveEmpty = r === 0 ? true : (data[(r - 1) * width + c] === 0)
      topMask[i] = here && aboveEmpty
    }
  }

  // Process each row: only tiles in topMask are remapped; others left as-is
  for (let row = 0; row < height; row++) {
    let col = 0
    while (col < width) {
      const idx = row * width + col
      if (topMask[idx]) {
        // find contiguous run in mask
        let start = col
        let end = col
        while (end + 1 < width && topMask[row * width + (end + 1)]) end++
        const len = end - start + 1
        if (len === 1) {
          data[row * width + start] = MID
        } else {
          data[row * width + start] = LEFT
          for (let c = start + 1; c < end; c++) data[row * width + c] = MID
          data[row * width + end] = RIGHT
        }
        col = end + 1
      } else {
        col++
      }
    }
  }
  layer.data = data
}

try {
  const raw = fs.readFileSync(filePath, 'utf8')
  const json = JSON.parse(raw)
  const platforms = json.layers.find(l => l.name === 'Platforms' && l.type === 'tilelayer')
  if (!platforms) {
    console.error('Platforms layer not found')
    process.exit(1)
  }
  autotilePlatforms(platforms, json.width, json.height)
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2))
  console.log('Updated:', filePath)
} catch (e) {
  console.error('Error:', e)
  process.exit(1)
}
