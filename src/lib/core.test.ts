import { describe, it, expect } from 'vitest'
import { parseTags } from './tags'
import { parseInline, type Inline } from './inline'
import { applyEvent, emptyState, liveEntries, tagCounts, actorCount } from './reducer'
import { appendLine, foldTail, isShardPath, shardForDate } from './log'
import { serializeEvent, type LoggedEvent } from './events'

function ev(partial: Partial<LoggedEvent> & Pick<LoggedEvent, 'type' | 'subject'>): LoggedEvent {
  return {
    id: partial.id ?? `evt_${Math.random().toString(36).slice(2)}`,
    ts: partial.ts ?? '2026-07-09T12:00:00.000Z',
    actor: partial.actor ?? { id: 'u1', name: 'You' },
    type: partial.type,
    subject: partial.subject,
    ...(partial.data ? { data: partial.data } : {}),
  }
}

describe('tags', () => {
  it('parses distinct lowercased hashtags', () => {
    expect(parseTags('an #Idea and another #idea plus #ship-it')).toEqual(['idea', 'ship-it'])
  })

  it('ignores # mid-word and in url fragments', () => {
    expect(parseTags('email a#b, see http://x.com/p#frag')).toEqual([])
  })

})

describe('inline markdown', () => {
  // flatten to a compact [type, text?] view for easy assertions
  function shape(nodes: Inline[]): string[] {
    return nodes.map((n) => {
      switch (n.t) {
        case 'text':
          return `text:${n.v}`
        case 'tag':
          return `tag:${n.label}`
        case 'url':
          return `url:${n.href}`
        case 'code':
          return `code:${n.v}`
        case 'strong':
          return `strong(${shape(n.children).join('|')})`
        case 'em':
          return `em(${shape(n.children).join('|')})`
        case 'link':
          return `link:${n.href}(${shape(n.children).join('|')})`
      }
    })
  }

  it('parses tags and bare urls', () => {
    expect(shape(parseInline('hi #idea see https://x.com done'))).toEqual([
      'text:hi ',
      'tag:idea',
      'text: see ',
      'url:https://x.com',
      'text: done',
    ])
  })

  it('parses bold, italic, and inline code', () => {
    expect(shape(parseInline('**b** and *i* and `c`'))).toEqual([
      'strong(text:b)',
      'text: and ',
      'em(text:i)',
      'text: and ',
      'code:c',
    ])
  })

  it('reads ** as strong, not two ems', () => {
    expect(shape(parseInline('**bold**'))).toEqual(['strong(text:bold)'])
  })

  it('parses markdown links and keeps the label', () => {
    expect(shape(parseInline('see [my site](https://x.com) ok'))).toEqual([
      'text:see ',
      'link:https://x.com(text:my site)',
      'text: ok',
    ])
  })

  it('does not format inside inline code', () => {
    expect(shape(parseInline('`**not bold**`'))).toEqual(['code:**not bold**'])
  })

  it('leaves unmatched markers as plain text', () => {
    expect(shape(parseInline('a * b and c'))).toEqual(['text:a * b and c'])
  })
})

describe('reducer', () => {
  it('creates, edits (LWW), and tombstones entries', () => {
    const s = emptyState()
    applyEvent(s, ev({ type: 'log.entry', subject: 'ent_1', ts: '2026-07-09T10:00:00.000Z', data: { body: 'first #a', tags: ['a'] } }))
    expect(liveEntries(s)).toHaveLength(1)
    expect(liveEntries(s)[0]!.body).toBe('first #a')

    // a later edit wins…
    applyEvent(s, ev({ type: 'log.edit', subject: 'ent_1', ts: '2026-07-09T11:00:00.000Z', data: { body: 'edited #b', tags: ['b'] } }))
    expect(liveEntries(s)[0]!.body).toBe('edited #b')
    expect(liveEntries(s)[0]!.editedAt).toBe('2026-07-09T11:00:00.000Z')

    // …an older edit (out-of-order arrival) does not
    applyEvent(s, ev({ type: 'log.edit', subject: 'ent_1', ts: '2026-07-09T10:30:00.000Z', data: { body: 'stale', tags: [] } }))
    expect(liveEntries(s)[0]!.body).toBe('edited #b')

    applyEvent(s, ev({ type: 'log.delete', subject: 'ent_1' }))
    expect(liveEntries(s)).toHaveLength(0)
  })

  it('is idempotent on duplicate event ids', () => {
    const s = emptyState()
    const e = ev({ id: 'evt_x', type: 'log.entry', subject: 'ent_1', data: { body: 'x', tags: [] } })
    applyEvent(s, e)
    applyEvent(s, e)
    expect(liveEntries(s)).toHaveLength(1)
  })

  it('orders the stream by original createdAt, stable across edits', () => {
    const s = emptyState()
    applyEvent(s, ev({ id: 'evt_a', type: 'log.entry', subject: 'ent_a', ts: '2026-07-09T10:00:00.000Z', data: { body: 'A', tags: [] } }))
    applyEvent(s, ev({ id: 'evt_b', type: 'log.entry', subject: 'ent_b', ts: '2026-07-09T11:00:00.000Z', data: { body: 'B', tags: [] } }))
    // edit the older one later — it must NOT jump to the bottom
    applyEvent(s, ev({ id: 'evt_a2', type: 'log.edit', subject: 'ent_a', ts: '2026-07-09T12:00:00.000Z', data: { body: 'A2', tags: [] } }))
    expect(liveEntries(s).map((e) => e.id)).toEqual(['ent_a', 'ent_b'])
  })

  it('counts tags and distinct actors over live entries', () => {
    const s = emptyState()
    applyEvent(s, ev({ id: 'e1', type: 'log.entry', subject: 'ent_1', actor: { id: 'u1', name: 'You' }, data: { body: '#x #y', tags: ['x', 'y'] } }))
    applyEvent(s, ev({ id: 'e2', type: 'log.entry', subject: 'ent_2', actor: { id: 'u2', name: 'Ada' }, data: { body: '#x', tags: ['x'] } }))
    expect(tagCounts(s)).toEqual([
      { tag: 'x', count: 2 },
      { tag: 'y', count: 1 },
    ])
    expect(actorCount(s)).toBe(2)
    applyEvent(s, ev({ id: 'e3', type: 'log.delete', subject: 'ent_2' }))
    expect(actorCount(s)).toBe(1)
    expect(tagCounts(s)).toEqual([
      { tag: 'x', count: 1 },
      { tag: 'y', count: 1 },
    ])
  })
})

describe('log shards', () => {
  it('names monthly shards and recognizes them', () => {
    const path = shardForDate(new Date('2026-07-09T12:00:00.000Z'))
    expect(path).toMatch(/^v0\/log\/2026-07\.jsonl$/)
    expect(isShardPath(path)).toBe(true)
    expect(isShardPath('v0/log/nope.txt')).toBe(false)
  })

  it('folds only complete lines and resumes from the cursor', () => {
    const s = emptyState()
    const l1 = serializeEvent(ev({ id: 'e1', type: 'log.entry', subject: 'ent_1', data: { body: 'one', tags: [] } }))
    const l2 = serializeEvent(ev({ id: 'e2', type: 'log.entry', subject: 'ent_2', data: { body: 'two', tags: [] } }))

    const content = appendLine(appendLine('', l1), l2)
    const c1 = foldTail(s, content.slice(0, content.indexOf('\n') + 1), 0)
    expect(liveEntries(s)).toHaveLength(1)

    // fold the rest from the cursor → picks up l2, consumes to the end
    const c2 = foldTail(s, content, c1)
    expect(liveEntries(s)).toHaveLength(2)
    expect(c2).toBe(content.length)

    // a half-synced trailing line (no newline yet) is not consumed, cursor holds
    const partial = content + '{"id":"e3","type":"log.entry"'
    const c3 = foldTail(s, partial, c2)
    expect(liveEntries(s)).toHaveLength(2)
    expect(c3).toBe(c2)
  })
})
