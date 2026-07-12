// The projection: fold the event log into the current stream of entries.
// Application is idempotent (each event id applied at most once) so re-folding a
// shard tail, or seeing our own optimistic write echoed back by the watch, is
// always safe.
//
// An entry is created by `log.entry`, its text replaced by `log.edit`
// (last-writer-wins by ts), and hidden by `log.delete`. Its position in the
// stream is its ORIGINAL createdAt — editing a line never moves it.

import type { Actor, LoggedEvent } from './events'

export interface EntryRecord {
  id: string
  body: string
  tags: string[]
  actor: Actor | null
  /** original entry time — the stream is ordered by this, stable across edits */
  createdAt: string
  /** ts of the most recent edit, or null if never edited */
  editedAt: string | null
  deleted: boolean
}

export interface State {
  entries: Record<string, EntryRecord>
  applied: Set<string>
}

export function emptyState(): State {
  return { entries: {}, applied: new Set() }
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asTags(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : []
}

export function applyEvent(state: State, ev: LoggedEvent): void {
  if (state.applied.has(ev.id)) return
  state.applied.add(ev.id)

  const [entity, verb] = ev.type.split('.')
  if (entity !== 'log') return // forward-compatible: ignore unknown entities
  const data = ev.data ?? {}

  if (verb === 'entry') {
    if (state.entries[ev.subject]) return
    state.entries[ev.subject] = {
      id: ev.subject,
      body: asString(data.body),
      tags: asTags(data.tags),
      actor: ev.actor,
      createdAt: ev.ts,
      editedAt: null,
      deleted: false,
    }
    return
  }

  const rec = state.entries[ev.subject]
  if (!rec) return // edit/delete for an entry we haven't seen (yet) — no-op

  if (verb === 'edit') {
    // LWW: only the latest edit (by ts) wins.
    const cur = rec.editedAt ?? rec.createdAt
    if (ev.ts < cur) return
    rec.body = asString(data.body)
    rec.tags = asTags(data.tags)
    rec.editedAt = ev.ts
  } else if (verb === 'delete') {
    rec.deleted = true
  }
}

// ── selectors ────────────────────────────────────────────────────────────────

function byCreated(a: EntryRecord, b: EntryRecord): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  return a.id < b.id ? -1 : 1 // stable tiebreak on same-ms entries
}

/** Live entries, oldest first (top of the stream) → newest last (by the input). */
export function liveEntries(state: State): EntryRecord[] {
  return Object.values(state.entries)
    .filter((e) => !e.deleted)
    .sort(byCreated)
}

/** Tag → count across live entries, most-used first. */
export function tagCounts(state: State): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const e of Object.values(state.entries)) {
    if (e.deleted) continue
    for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** Distinct actors among live entries — >1 means it's a shared log. */
export function actorCount(state: State): number {
  const ids = new Set<string>()
  for (const e of Object.values(state.entries)) {
    if (!e.deleted && e.actor) ids.add(e.actor.id)
  }
  return ids.size
}
