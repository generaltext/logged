import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import type { EntryRecord } from '../lib/reducer'
import { EntryRow } from './EntryRow'
import { dayKey, formatDayHeading } from '../lib/format'

/**
 * The stream: oldest at the top, newest at the bottom, next to the input. Opens
 * scrolled to the bottom and stays pinned there as new entries land — UNLESS
 * you've scrolled up to read, in which case a "↓ N new" pill appears instead of
 * yanking you down. Applying a filter re-pins you to the bottom of the results.
 */
export function Stream({
  entries,
  filterKey,
  showActor,
  onToggleTag,
  onEdit,
  onDelete,
}: {
  entries: EntryRecord[]
  filterKey: string
  showActor: boolean
  onToggleTag: (tag: string) => void
  onEdit: (id: string, body: string) => void
  onDelete: (id: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const prevLenRef = useRef(0)
  const prevFilterRef = useRef(filterKey)
  const [newCount, setNewCount] = useState(0)

  function atBottom(): boolean {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  function toBottom() {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  useLayoutEffect(() => {
    const filterChanged = prevFilterRef.current !== filterKey
    if (filterChanged) {
      prevFilterRef.current = filterKey
      prevLenRef.current = entries.length
      pinnedRef.current = true
      setNewCount(0)
      toBottom()
      return
    }
    const added = entries.length - prevLenRef.current
    prevLenRef.current = entries.length
    if (pinnedRef.current) {
      toBottom()
      setNewCount(0)
    } else if (added > 0) {
      setNewCount((n) => n + added)
    }
  }, [entries, filterKey])

  function onScroll() {
    pinnedRef.current = atBottom()
    if (pinnedRef.current && newCount) setNewCount(0)
  }

  let lastDay = ''

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="absolute inset-0 overflow-y-auto">
        {entries.length === 0 ? (
          <EmptyState filtered={filterKey !== ''} />
        ) : (
          // Bottom-anchored: a short log hugs the input and grows upward (older
          // entries drift to the top), like a tail -f / papertrail view.
          <div className="flex min-h-full flex-col justify-end py-2">
            {entries.map((entry) => {
              const key = dayKey(entry.createdAt)
              const showDivider = key !== lastDay
              lastDay = key
              return (
                <Fragment key={entry.id}>
                  {showDivider && (
                    <div className="flex items-center gap-3 px-4 pb-1 pt-4">
                      <span
                        className="text-[0.68rem] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--muted)' }}
                      >
                        {formatDayHeading(entry.createdAt)}
                      </span>
                      <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
                    </div>
                  )}
                  <EntryRow
                    entry={entry}
                    showActor={showActor}
                    onToggleTag={onToggleTag}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </Fragment>
              )
            })}
          </div>
        )}
      </div>

      {newCount > 0 && (
        <button
          type="button"
          onClick={() => {
            pinnedRef.current = true
            setNewCount(0)
            toBottom()
          }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs shadow-md"
          style={{ background: 'var(--accent)', color: '#fff', borderColor: 'transparent' }}
        >
          <ArrowDown size={13} />
          {newCount} new
        </button>
      )}
    </div>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex h-full items-center justify-center px-8 text-center">
      <div style={{ color: 'var(--muted)' }} className="text-sm leading-relaxed">
        {filtered ? (
          <>No entries match this filter.</>
        ) : (
          <>
            <div className="mb-1 font-semibold" style={{ color: 'var(--fg)' }}>
              The log is empty.
            </div>
            Type below to record the first entry. Tag it inline with{' '}
            <span className="tag tag-teal">#hashtags</span>.
          </>
        )}
      </div>
    </div>
  )
}
