// A tiny inline parser: bold / italic / inline-code / links, plus the log's own
// `#hashtags` and bare URLs. We store bodies as plain markdown and render them
// styled on display (the composer stays a textarea — see lib/editor.ts for the
// shortcuts that make it feel rich). Deliberately non-nesting-heavy and
// block-free: a log line is short, not a document.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'tag'; label: string; raw: string }
  | { t: 'url'; href: string }
  | { t: 'link'; href: string; children: Inline[] }
  | { t: 'strong'; children: Inline[] }
  | { t: 'em'; children: Inline[] }
  | { t: 'code'; v: string }

// Matched at the current scan position; earliest match wins, ties broken by the
// order below (so `**` reads as strong before em sees a single `*`).
const CODE = /`([^`\n]+)`/
const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/
const STRONG = /\*\*([^\n]+?)\*\*/
const EM = /\*([^\s*][^\n]*?)\*/
const TAG = /(?<![\w#])#([a-z0-9][\w-]*)/i
const URL = /(?<![\w@])(https?:\/\/[^\s<]+)/i

const MAX_DEPTH = 6

interface Found {
  index: number
  len: number
  node: Inline
}

function findFirst(rest: string, depth: number): Found | null {
  const rules: Array<() => Found | null> = [
    () => match(CODE, rest, (m) => ({ t: 'code', v: m[1]! })),
    () => match(LINK, rest, (m) => ({ t: 'link', href: m[2]!, children: parseInline(m[1]!, depth + 1) })),
    () => match(STRONG, rest, (m) => ({ t: 'strong', children: parseInline(m[1]!, depth + 1) })),
    () => match(EM, rest, (m) => ({ t: 'em', children: parseInline(m[1]!, depth + 1) })),
    () => match(TAG, rest, (m) => ({ t: 'tag', label: m[1]!.toLowerCase(), raw: m[0] })),
    () => match(URL, rest, (m) => ({ t: 'url', href: m[1]! })),
  ]
  let best: Found | null = null
  for (const rule of rules) {
    const f = rule()
    if (f && (best === null || f.index < best.index)) best = f
    if (best && best.index === 0) break // can't beat position 0
  }
  return best
}

function match(re: RegExp, rest: string, make: (m: RegExpMatchArray) => Inline): Found | null {
  const m = re.exec(rest)
  if (!m || m.index === undefined) return null
  return { index: m.index, len: m[0].length, node: make(m) }
}

export function parseInline(text: string, depth = 0): Inline[] {
  if (depth > MAX_DEPTH || text === '') return text ? [{ t: 'text', v: text }] : []
  const out: Inline[] = []
  let rest = text
  while (rest.length) {
    const f = findFirst(rest, depth)
    if (!f) {
      out.push({ t: 'text', v: rest })
      break
    }
    if (f.index > 0) out.push({ t: 'text', v: rest.slice(0, f.index) })
    out.push(f.node)
    rest = rest.slice(f.index + f.len)
  }
  return out
}
