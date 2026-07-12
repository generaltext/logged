import { useEffect, useRef, useState } from 'react'
import { Tag, ChevronDown, Check } from 'lucide-react'
import { tagColorClass } from '../lib/tags'

/**
 * A compact "Tags" button that opens a popover of toggleable tags. Keeps the
 * filter bar to a single row and scales to many tags (the list scrolls) instead
 * of a chip wall that eats vertical space.
 */
export function TagMenu({
  tags,
  active,
  onToggleTag,
  onClearTags,
}: {
  tags: { tag: string; count: number }[]
  active: Set<string>
  onToggleTag: (tag: string) => void
  onClearTags: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const count = active.size
  const activeStyle = count > 0 ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : undefined

  return (
    <div className="relative flex-none" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[0.78rem]"
        style={activeStyle}
      >
        <Tag size={13} />
        <span>Tags</span>
        {count > 0 && (
          <span
            className="grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.62rem] font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {count}
          </span>
        )}
        <ChevronDown size={12} style={{ color: 'var(--muted)' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-1 max-h-[60vh] w-60 overflow-y-auto rounded-md border bg-[var(--panel)] p-1 shadow-lg"
        >
          {tags.length === 0 ? (
            <div className="px-2 py-3 text-center text-[0.78rem]" style={{ color: 'var(--muted)' }}>
              No tags yet. Type <span className="tag tag-teal">#tag</span> in an entry.
            </div>
          ) : (
            <>
              {tags.map(({ tag, count: c }) => {
                const on = active.has(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleTag(tag)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[var(--hover)]"
                  >
                    <Check
                      size={13}
                      style={{ color: 'var(--accent)', visibility: on ? 'visible' : 'hidden' }}
                    />
                    <span className={`tag ${tagColorClass(tag)}`}>#{tag}</span>
                    <span className="ml-auto text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                      {c}
                    </span>
                  </button>
                )
              })}
              {count > 0 && (
                <div className="mt-1 border-t pt-1">
                  <button
                    type="button"
                    onClick={onClearTags}
                    className="w-full rounded px-2 py-1.5 text-left text-[0.78rem] hover:bg-[var(--hover)]"
                    style={{ color: 'var(--muted)' }}
                  >
                    Clear {count} tag{count > 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
