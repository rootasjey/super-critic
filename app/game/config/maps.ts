export type MapKey = 'first-scene'

export function getSelectedMap(): MapKey {
  try {
    const params = new URLSearchParams(window.location.search)
    const v = (params.get('map') || '').toLowerCase()
    if (v === 'first-scene') return 'first-scene'
  } catch {}
  return 'first-scene'
}

export function rawMapCacheKey(map: MapKey): string {
  // cache keys used during preload
  if (map === 'first-scene') return 'stage0_raw'
  return 'stage0_raw'
}

export function embeddedMapCacheKey(map: MapKey): string {
  return `${map}-embedded`
}
