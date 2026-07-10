import { useEffect, useRef, useState } from 'react'
import { handleMarkdownKey, handleUrlPaste } from '../lib/editor'

/**
 * The always-there input, pinned to the bottom. Enter records the entry and
 * stamps the moment; Shift+Enter inserts a newline. ⌘/Ctrl+B/I/E/K format the
 * selection (bold/italic/code/link); pasting a URL over a selection links it. A
 * global "/" focuses it from anywhere so capture is always one keystroke away.
 */
export function Composer({
  onSubmit,
  onTyping,
  typingUsers,
}: {
  onSubmit: (body: string) => void
  onTyping: (typing: boolean) => void
  typingUsers: string[]
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  function grow() {
    const ta = ref.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }

  useEffect(grow, [value])

  // Autofocus on mount, and let "/" refocus from anywhere.
  useEffect(() => {
    ref.current?.focus()
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      if (e.key === '/' && !typing) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function change(next: string) {
    setValue(next)
    onTyping(next.trim().length > 0)
  }

  function submit() {
    const body = value.trim()
    if (!body) return
    onSubmit(body)
    setValue('')
    onTyping(false)
    requestAnimationFrame(() => ref.current?.focus())
  }

  const typingLabel = formatTyping(typingUsers)

  return (
    <div className="flex-none border-t bg-[var(--panel)] px-4 py-3">
      {typingLabel && (
        <div className="mb-1 text-[0.7rem] italic" style={{ color: 'var(--muted)' }}>
          {typingLabel}
        </div>
      )}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          const formatted = handleMarkdownKey(e)
          if (formatted != null) {
            change(formatted)
            return
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        onPaste={(e) => {
          const linked = handleUrlPaste(e)
          if (linked != null) change(linked)
        }}
        onBlur={() => onTyping(false)}
        rows={1}
        placeholder="Log a moment…  (enter to record · #tag inline · **bold** ⌘B · shift+enter for a newline)"
        className="max-h-[200px] w-full resize-none bg-transparent py-1.5 text-[0.9rem] outline-none placeholder:text-[var(--muted)]"
        style={{ caretColor: 'var(--accent)' }}
      />
    </div>
  )
}

function formatTyping(names: string[]): string | null {
  if (names.length === 0) return null
  if (names.length === 1) return `${names[0]} is typing…`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
  return `${names[0]}, ${names[1]} and ${names.length - 2} more are typing…`
}
