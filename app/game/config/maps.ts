export type MapKey = 'stage-0'

export function getSelectedMap(): MapKey {
  try {
    const params = new URLSearchParams(window.location.search)
    const v = (params.get('map') || '').toLowerCase()
    if (v === 'stage-0' || v === '0' || v === 'stage0') return 'stage-0'
  } catch {}
  return 'stage-0'
}

export function rawMapCacheKey(map: MapKey): string {
  // cache keys used during preload
  if (map === 'stage-0') return 'stage0_raw'
  return 'stage0_raw'
}

export function embeddedMapCacheKey(map: MapKey): string {
  return `${map}-embedded`
}
