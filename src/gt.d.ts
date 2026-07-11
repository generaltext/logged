// window.gt is injected by General Text at runtime (dev: from the public runtime
// URL via the vite plugin; prod: by the platform). This is a pragmatic subset of
// the contract documented at https://www.generaltext.org/llms.txt — the surfaces
// Logged actually uses.

export interface GtUser {
  id: string
  name: string
  image?: string
}

export interface GtFileEntry {
  path: string
  sizeBytes: number
}

export type GtMode = 'live' | 'demo'

// A y-protocols Awareness, bound to a file's doc and synced to everyone viewing
// it. Ephemeral: never written to disk, dropped on disconnect. (runtime 1.5+)
export interface GtAwareness {
  clientID: number
  getStates(): Map<number, Record<string, unknown>>
  setLocalState(state: Record<string, unknown> | null): void
  setLocalStateField(field: string, value: unknown): void
  on(event: 'change' | 'update', cb: () => void): void
  off(event: 'change' | 'update', cb: () => void): void
}

export interface GtRuntime {
  ready: Promise<void>
  version: string
  mode: GtMode
  workspaceId: string
  connected: boolean

  atLeast(version: string): boolean
  require(version: string): void

  user(): Promise<GtUser | null>

  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  listFiles(): Promise<GtFileEntry[]>
  files(): string[]

  watch(path: string, cb: (content: string) => void): () => void
  watchFiles(cb: (paths: string[]) => void): () => void

  subscribeFileAwareness?(path: string): GtAwareness
  unsubscribeFile?(path: string): void

  on(event: string, cb: (arg?: unknown) => void): void
}

declare global {
  interface Window {
    gt: GtRuntime
    /** Opt-in runtime boot config, set before loading /__gt/runtime.js to force a
     *  local in-browser workspace — used by the standalone demo (see main.tsx).
     *  Never set inside General Text. */
    __gtConfig?: { local?: boolean }
    /** Marks the standalone "try the demo" session, so the store seeds sample data. */
    __loggedDemo?: boolean
  }
}

export {}
