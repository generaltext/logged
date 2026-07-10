// The event envelope. One JSON object per line in the log; immutable once
// written. LOGGED has exactly three event types — the simplest instance of the
// event-sourced model: log.entry (a new line), log.edit (fix an earlier line),
// log.delete (tombstone one). Edits and deletes are new events, never rewrites.

export interface Actor {
  id: string
  name: string
}

export interface LoggedEvent {
  /** evt_<ulid> — unique, sortable, used for dedupe/idempotency */
  id: string
  /** ISO timestamp from the writing client (display + LWW tiebreak) */
  ts: string
  /** who wrote it, from gt.user() (or a local fallback); null if unknown */
  actor: Actor | null
  /** "log.entry" | "log.edit" | "log.delete" */
  type: string
  /** the entry (ent_<ulid>) this event is about */
  subject: string
  /** verb-specific payload */
  data?: Record<string, unknown>
}

/** A change to append, before the envelope is stamped (id/ts/actor added by the store). */
export interface Draft {
  type: string
  subject: string
  data?: Record<string, unknown>
}

export function serializeEvent(ev: LoggedEvent): string {
  return JSON.stringify(ev)
}

export function parseEvent(line: string): LoggedEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const obj = JSON.parse(trimmed) as LoggedEvent
    if (
      typeof obj.id === 'string' &&
      typeof obj.type === 'string' &&
      typeof obj.subject === 'string'
    ) {
      return obj
    }
  } catch {
    // A malformed line (a half-synced write, a hand-edit) is skipped, not fatal.
  }
  return null
}
