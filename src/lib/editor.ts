// Markdown-assist for a plain <textarea>: keyboard shortcuts that wrap the
// selection in markers (so the composer feels rich without a rich-text engine),
// and a paste handler that turns "select text → paste a URL" into a link.
// Each helper mutates the element's value/selection in place and returns the new
// value string for the caller to push into React state.

import type { ClipboardEvent, KeyboardEvent } from 'react'

export function isUrl(s: string): boolean {
  return /^(https?:\/\/|mailto:)[^\s]+$/i.test(s.trim())
}

function wrap(el: HTMLTextAreaElement, before: string, after: string, placeholder: string): string {
  const start = el.selectionStart
  const end = el.selectionEnd
  const sel = el.value.slice(start, end) || placeholder
  el.setRangeText(before + sel + after, start, end, 'end')
  // Select the inner text so the user can overtype the placeholder immediately.
  el.selectionStart = start + before.length
  el.selectionEnd = start + before.length + sel.length
  return el.value
}

function link(el: HTMLTextAreaElement, url: string, selectUrl: boolean): string {
  const start = el.selectionStart
  const end = el.selectionEnd
  const label = el.value.slice(start, end) || 'text'
  const insert = `[${label}](${url})`
  el.setRangeText(insert, start, end, 'end')
  if (selectUrl) {
    // Put the selection on the "url" placeholder for immediate overtype.
    const urlStart = start + 1 + label.length + 2 // after "[label]("
    el.selectionStart = urlStart
    el.selectionEnd = urlStart + url.length
  } else {
    const caret = start + insert.length
    el.selectionStart = el.selectionEnd = caret
  }
  return el.value
}

/**
 * Handle a formatting shortcut. Returns the new textarea value if it handled the
 * key (caller must push it into state), or null to let the event proceed.
 * ⌘/Ctrl+B bold · ⌘/Ctrl+I italic · ⌘/Ctrl+E code · ⌘/Ctrl+K link.
 */
export function handleMarkdownKey(e: KeyboardEvent<HTMLTextAreaElement>): string | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null
  const el = e.currentTarget
  switch (e.key.toLowerCase()) {
    case 'b':
      e.preventDefault()
      return wrap(el, '**', '**', 'bold')
    case 'i':
      e.preventDefault()
      return wrap(el, '*', '*', 'italic')
    case 'e':
      e.preventDefault()
      return wrap(el, '`', '`', 'code')
    case 'k':
      e.preventDefault()
      return link(el, 'url', true)
    default:
      return null
  }
}

/**
 * If a URL is pasted while text is selected, wrap the selection as a link.
 * Returns the new value, or null to allow the normal paste.
 */
export function handleUrlPaste(e: ClipboardEvent<HTMLTextAreaElement>): string | null {
  const el = e.currentTarget
  if (el.selectionStart === el.selectionEnd) return null // nothing selected → normal paste
  const pasted = e.clipboardData.getData('text')
  if (!isUrl(pasted)) return null
  e.preventDefault()
  return link(el, pasted.trim(), false)
}
