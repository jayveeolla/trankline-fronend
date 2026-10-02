/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAP_TILE_URL?: string
  readonly VITE_MAP_PROVIDER?: 'vector' | 'osm' | 'google'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
