import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import type { EntryRecord } from '../lib/reducer'
import { EntryText } from './EntryText'
import { handleMarkdownKey, handleUrlPaste } from '../lib/editor'
import { actorColor, formatClockShort, formatDateTime, initials, relativeTime } from '../lib/format'

export function EntryRow({
  entry,
  showActor,
  onToggleTag,
  onEdit,
  onDelete,
}: {
  entry: EntryRecord
  showActor: boolean
  onToggleTag: (tag: string) => void
  onEdit: (id: string, body: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.body)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      const ta = taRef.current
      if (ta) {
        ta.style.height = 'auto'
        ta.style.height = `${ta.scrollHeight}px`
        ta.focus()
        ta.setSelectionRange(ta.value.length, ta.value.length)
      }
    }
  }, [editing])

  function begin() {
    setDraft(entry.body)
    setEditing(true)
  }

  function save() {
    const next = draft.trim()
    if (next && next !== entry.body) onEdit(entry.id, next)
    setEditing(false)
  }

  function cancel() {
    setEditing(false)
    setDraft(entry.body)
  }

  return (
    <div className="group flex flex-col gap-0.5 px-4 py-1.5 leading-relaxed hover:bg-[var(--hover)] sm:flex-row sm:items-start sm:gap-3">
      {/* meta: its own row on mobile (time + actor), a dense gutter on desktop */}
      <div
        className="flex flex-none items-center gap-2 select-none sm:pt-0.5"
        title={`${formatDateTime(entry.createdAt)}${entry.editedAt ? ` · edited ${relativeTime(entry.editedAt)}` : ''}`}
      >
        <span
          className="tabular-nums sm:w-[3.2rem] sm:text-right"
          style={{ color: 'var(--muted)', fontSize: '0.72rem' }}
        >
          {formatClockShort(entry.createdAt)}
        </span>
        {showActor && (
          <span
            className="grid h-4 w-4 place-items-center rounded text-[0.55rem] font-bold text-white sm:h-5 sm:w-5 sm:text-[0.6rem]"
            style={{ background: actorColor(entry.actor?.id ?? '?') }}
            title={entry.actor?.name ?? 'Unknown'}
          >
            {initials(entry.actor?.name ?? '?')}
          </span>
        )}
      </div>

      {/* body */}
      <div className="min-w-0 flex-1 text-[0.9rem]">
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              ref={taRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${e.target.scrollHeight}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  save()
                  return
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancel()
                  return
                }
                const formatted = handleMarkdownKey(e)
                if (formatted != null) setDraft(formatted)
              }}
              onPaste={(e) => {
                const linked = handleUrlPaste(e)
                if (linked != null) setDraft(linked)
              }}
              className="w-full resize-none rounded border bg-[var(--panel)] px-2 py-1.5 text-[0.9rem] outline-none focus:border-[var(--accent)]"
              style={{ caretColor: 'var(--accent)' }}
              rows={1}
            />
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <button
                type="button"
                onClick={save}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-white"
                style={{ background: 'var(--accent)' }}
              >
                <Check size={12} /> Save
              </button>
              <button
                type="button"
                onClick={cancel}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-[var(--hover)]"
              >
                <X size={12} /> Cancel
              </button>
              <span className="ml-auto opacity-70">⌘↵ to save · esc to cancel</span>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <EntryText body={entry.body} onToggleTag={onToggleTag} />
              {entry.editedAt && (
                <span className="ml-1.5 text-[0.68rem] italic" style={{ color: 'var(--muted)' }}>
                  (edited)
                </span>
              )}
            </div>
            {/* actions: always faintly present on touch, hover-reveal on desktop */}
            <div className="flex flex-none items-center gap-0.5 opacity-50 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <button
                type="button"
                onClick={begin}
                title="Edit"
                className="grid h-6 w-6 place-items-center rounded hover:bg-[var(--panel)]"
                style={{ color: 'var(--muted)' }}
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(entry.id)}
                title="Delete"
                className="grid h-6 w-6 place-items-center rounded hover:bg-[var(--panel)] hover:text-[var(--accent)]"
                style={{ color: 'var(--muted)' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
