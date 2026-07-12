// Seed the live demo with a realistic, backdated captain's log so the "Try it
// live" session opens with a stream that shows the app at its best — a few days
// of entries, spanning tags, and one line from a second person to show that a
// log can be shared. Written straight to the shards (not via dispatch) so each
// entry keeps its own backdated timestamp and the day-dividers have something to
// divide.

import type { Actor, LoggedEvent } from './events'
import { serializeEvent } from './events'
import { newId } from './ids'
import { appendLine, shardForDate } from './log'
import { parseTags } from './tags'

const ME: Actor = { id: 'demo_me', name: 'You' }
const ADA: Actor = { id: 'demo_ada', name: 'Ada' }

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

interface Seed {
  ago: number
  actor: Actor
  body: string
}

// Newest first here (ago ascending is applied below); reads like a real log.
const SEEDS: Seed[] = [
  { ago: 4 * MIN, actor: ME, body: 'Name landed. The tool is #logged. type, hit enter, it thunks onto the record.' },
  { ago: 40 * MIN, actor: ME, body: 'Reread yesterday\'s stream on the walk. the #idea about pricing per-seat still holds up.' },
  { ago: 3 * HOUR, actor: ADA, body: 'Pushed the sync fix — offline edits now reconcile cleanly. patched `foldTail` to resume from the cursor. #ship #sync' },
  { ago: 5 * HOUR, actor: ME, body: 'Coffee with M. She said *"the best tools disappear."* been chewing on it since. #memory' },
  { ago: 8 * HOUR, actor: ME, body: '#idea a captain\'s-log app where tagging is **just typing #hashtags inline**. no filing. ref: [digital gardens](https://maggieappleton.com/garden-history)' },
  { ago: 1 * DAY + 2 * HOUR, actor: ME, body: 'Shipped the gallery live-demo. watching strangers try it is the whole reward. #ship' },
  { ago: 1 * DAY + 6 * HOUR, actor: ADA, body: 'Found a gnarly race in the append path. two tabs, same instant. fixed. #sync #bug' },
  { ago: 1 * DAY + 9 * HOUR, actor: ME, body: 'Note to self: stop polishing the empty state before the full state exists. #reminder' },
  { ago: 2 * DAY + 3 * HOUR, actor: ME, body: 'The whole point of #saltbark: tools you own, that outlive the company that made them.' },
  { ago: 2 * DAY + 7 * HOUR, actor: ME, body: 'Slept on the schema. append-only is the right bet — the file is the contract. #idea' },
  { ago: 3 * DAY + 4 * HOUR, actor: ME, body: 'Started sketching a log tool. #idea kept losing thoughts between having them and writing them down.' },
]

/** Build the backdated demo events, grouped by the shard each falls into. */
export function buildSeedShards(now = Date.now()): Record<string, string> {
  const shards: Record<string, string> = {}
  // Apply oldest → newest so ids (time-prefixed) also sort in stream order.
  const ordered = [...SEEDS].sort((a, b) => b.ago - a.ago)
  for (const s of ordered) {
    const when = new Date(now - s.ago)
    const ev: LoggedEvent = {
      id: newId('evt'),
      ts: when.toISOString(),
      actor: s.actor,
      type: 'log.entry',
      subject: newId('ent'),
      data: { body: s.body, tags: parseTags(s.body) },
    }
    const path = shardForDate(when)
    shards[path] = appendLine(shards[path] ?? '', serializeEvent(ev))
  }
  return shards
}
