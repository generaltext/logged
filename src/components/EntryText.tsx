import { Fragment, type ReactNode } from 'react'
import { parseInline, type Inline } from '../lib/inline'
import { tagColorClass } from '../lib/tags'

/**
 * Renders an entry body: markdown-lite (bold, italic, inline code, links) plus
 * the log's `#hashtags` (clickable chips) and bare URLs. Whitespace and newlines
 * are preserved by the `whitespace-pre-wrap` container.
 */
export function EntryText({
  body,
  onToggleTag,
}: {
  body: string
  onToggleTag: (tag: string) => void
}) {
  return (
    <span className="whitespace-pre-wrap break-words">{render(parseInline(body), onToggleTag)}</span>
  )
}

function render(nodes: Inline[], onToggleTag: (tag: string) => void): ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text':
        return <Fragment key={i}>{n.v}</Fragment>
      case 'strong':
        return <strong key={i}>{render(n.children, onToggleTag)}</strong>
      case 'em':
        return <em key={i}>{render(n.children, onToggleTag)}</em>
      case 'code':
        return (
          <code
            key={i}
            className="rounded px-1 py-0.5 text-[0.85em]"
            style={{ background: 'var(--hover)', border: '1px solid var(--border)' }}
          >
            {n.v}
          </code>
        )
      case 'tag':
        return (
          <button
            key={i}
            type="button"
            className={`tag ${tagColorClass(n.label)}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleTag(n.label)
            }}
          >
            {n.raw}
          </button>
        )
      case 'url':
        return (
          <Link key={i} href={n.href}>
            {n.href}
          </Link>
        )
      case 'link':
        return (
          <Link key={i} href={n.href}>
            {render(n.children, onToggleTag)}
          </Link>
        )
    }
  })
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="underline decoration-dotted underline-offset-2"
      style={{ color: 'var(--accent)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  )
}
