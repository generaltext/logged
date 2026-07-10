import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { type Actor, type Draft, type LoggedEvent, serializeEvent } from './events'
import { applyEvent, emptyState, type State } from './reducer'
import { appendLine, currentShardPath, foldTail, isShardPath } from './log'
import { loadCache, saveCache } from './cache'
import { newId, ulid } from './ids'
import { buildSeedShards } from './seed'
import { actorColor } from './format'
import type { GtAwareness } from '../gt.d'

export interface PresenceUser {
  id: string
  name: string
  color: string
}

interface StoreValue {
  ready: boolean
  connected: boolean
  me: Actor | null
  state: State
  /** monotonically bumped on every state change; use as a memo dep */
  version: number
  dispatch: (drafts: Draft | Draft[]) => Promise<void>
  /** live: everyone currently viewing this log (incl. you), deduped by user id */
  presentUsers: PresenceUser[]
  /** live: names of others typing right now */
  typingUsers: string[]
  /** publish your own typing state (auto-clears after a few idle seconds) */
  setTyping: (typing: boolean) => void
}

const StoreContext = createContext<StoreValue | null>(null)

async function resolveMe(): Promise<Actor> {
  try {
    const u = await window.gt.user()
    if (u) return { id: u.id, name: u.name }
  } catch {
    // fall through to local identity
  }
  let id = localStorage.getItem('logged.actor.id')
  if (!id) {
    id = `local_${ulid()}`
    localStorage.setItem('logged.actor.id', id)
  }
  const name = localStorage.getItem('logged.actor.name') || 'You'
  return { id, name }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef<State>(emptyState())
  const consumedRef = useRef<Record<string, number>>({})
  const meRef = useRef<Actor | null>(null)
  const workspaceRef = useRef<string>('local')
  const subscribed = useRef<Set<string>>(new Set())
  const stops = useRef<Array<() => void>>([])
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve())
  const bumpScheduled = useRef(false)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const awarenessRef = useRef<GtAwareness | null>(null)
  const presencePathRef = useRef<string>('')
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [version, setVersion] = useState(0)
  const [ready, setReady] = useState(false)
  const [connected, setConnected] = useState(true)
  const [me, setMe] = useState<Actor | null>(null)
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  function bump() {
    if (bumpScheduled.current) return
    bumpScheduled.current = true
    queueMicrotask(() => {
      bumpScheduled.current = false
      setVersion((v) => v + 1)
    })
  }

  function schedulePersist() {
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void saveCache(workspaceRef.current, stateRef.current, consumedRef.current)
    }, 1000)
  }

  function subscribeShard(path: string) {
    if (subscribed.current.has(path)) return
    subscribed.current.add(path)
    const stop = window.gt.watch(path, (content) => {
      const prev = consumedRef.current[path] ?? 0
      consumedRef.current[path] = foldTail(stateRef.current, content, prev)
      bump()
      schedulePersist()
    })
    stops.current.push(stop)
  }

  // ── presence (ephemeral: who's here + who's typing) ──────────────────────
  function recomputePresence() {
    const aw = awarenessRef.current
    if (!aw) {
      setPresentUsers([])
      setTypingUsers([])
      return
    }
    const here = new Map<string, PresenceUser>()
    const typing = new Map<string, string>()
    for (const [clientId, st] of aw.getStates()) {
      const u = st.user as PresenceUser | undefined
      if (!u || !u.id) continue
      here.set(u.id, { id: u.id, name: u.name, color: u.color })
      if (st.typing && clientId !== aw.clientID) typing.set(u.id, u.name)
    }
    setPresentUsers([...here.values()])
    setTypingUsers([...typing.values()])
  }

  // Attach presence to the file everyone naturally shares — the current month's
  // shard — and re-attach when the month rolls over. Best-effort: silently skips
  // on a runtime without awareness (pre-1.5) or before the first shard exists.
  function ensurePresence(path: string) {
    if (presencePathRef.current === path && awarenessRef.current) return
    if (typeof window.gt.subscribeFileAwareness !== 'function') return

    const prev = presencePathRef.current
    if (awarenessRef.current && prev) {
      try {
        awarenessRef.current.off('change', recomputePresence)
        awarenessRef.current.setLocalState(null)
      } catch {
        /* ignore */
      }
      window.gt.unsubscribeFile?.(prev)
      awarenessRef.current = null
    }

    try {
      const aw = window.gt.subscribeFileAwareness(path)
      awarenessRef.current = aw
      presencePathRef.current = path
      const meNow = meRef.current
      if (meNow) {
        aw.setLocalStateField('user', {
          id: meNow.id,
          name: meNow.name,
          color: actorColor(meNow.id),
        })
      }
      aw.on('change', recomputePresence)
      recomputePresence()
    } catch {
      // no awareness available — presence just stays empty
    }
  }

  function setTyping(typing: boolean) {
    const aw = awarenessRef.current
    if (!aw) return
    aw.setLocalStateField('typing', typing)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    if (typing) {
      typingTimer.current = setTimeout(() => {
        try {
          awarenessRef.current?.setLocalStateField('typing', false)
        } catch {
          /* ignore */
        }
      }, 4000)
    }
  }

  useEffect(() => {
    let disposed = false
    const localStops = stops.current

    async function boot() {
      await window.gt.ready
      if (disposed) return

      workspaceRef.current = window.gt.workspaceId || 'local'
      const actor = await resolveMe()
      meRef.current = actor
      setMe(actor)
      setConnected(window.gt.connected)

      const cached = await loadCache(workspaceRef.current)
      if (cached && !disposed) {
        stateRef.current = cached.state
        consumedRef.current = cached.consumed
      }

      // Seed sample content once, only when truly empty — BEFORE subscribing, so
      // the initial fold picks the seeded lines up as normal events. Runs in the
      // gallery "try it live" demo (mode 'demo') and the standalone deployed demo.
      if (window.gt.mode === 'demo' || window.__loggedDemo) {
        const files = await window.gt.listFiles()
        if (files.length === 0 && Object.keys(stateRef.current.entries).length === 0) {
          const shards = buildSeedShards()
          for (const [path, content] of Object.entries(shards)) {
            await window.gt.writeFile(path, content)
          }
        }
      }

      // Subscribe existing shards, and watch for new ones (a new month, or the
      // first entry) to appear. We don't pre-subscribe a not-yet-created shard:
      // dispatch subscribes it right after it writes, and watchFiles catches
      // shards created remotely.
      for (const p of window.gt.files()) if (isShardPath(p)) subscribeShard(p)
      window.gt.watchFiles((paths) => {
        for (const p of paths) if (isShardPath(p)) subscribeShard(p)
      })

      window.gt.on('connected', () => setConnected(true))
      window.gt.on('disconnected', () => setConnected(false))

      ensurePresence(currentShardPath())
      setReady(true)
    }

    void boot()
    return () => {
      disposed = true
      for (const stop of localStops) stop()
      if (typingTimer.current) clearTimeout(typingTimer.current)
      const aw = awarenessRef.current
      const path = presencePathRef.current
      if (aw && path) {
        try {
          aw.off('change', recomputePresence)
          aw.setLocalState(null)
        } catch {
          /* ignore */
        }
        window.gt.unsubscribeFile?.(path)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function dispatchImpl(drafts: Draft | Draft[]): Promise<void> {
    const list = Array.isArray(drafts) ? drafts : [drafts]
    if (list.length === 0) return
    const now = new Date().toISOString()
    const events: LoggedEvent[] = list.map((d) => ({
      id: newId('evt'),
      ts: now,
      actor: meRef.current,
      type: d.type,
      subject: d.subject,
      ...(d.data ? { data: d.data } : {}),
    }))

    // Optimistic apply for instant UI; the watch echo re-folds idempotently.
    for (const ev of events) applyEvent(stateRef.current, ev)
    bump()

    const path = currentShardPath()
    // Serialize writes and always base the append on the freshest content, so
    // the runtime's diff is a pure end-insertion (never a delete of a concurrent
    // remote line).
    const run = writeQueue.current.then(async () => {
      const exists = window.gt.files().includes(path)
      const base = exists ? await window.gt.readFile(path) : ''
      let content = base
      for (const ev of events) content = appendLine(content, serializeEvent(ev))
      await window.gt.writeFile(path, content)
      subscribeShard(path)
      ensurePresence(path) // follow the shard across a month rollover
    })
    writeQueue.current = run.catch(() => undefined)
    await run
  }

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      connected,
      me,
      state: stateRef.current,
      version,
      dispatch: dispatchImpl,
      presentUsers,
      typingUsers,
      setTyping,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, connected, me, version, presentUsers, typingUsers],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
