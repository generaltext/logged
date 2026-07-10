// Inline hashtags are the structuring mechanism: you type `#idea` mid-entry and
// it becomes a tag. This module owns tag *extraction* (for the tag index) and
// tag *color*; rendering lives in lib/inline.ts, which shares this boundary rule.

// A `#` that starts a word (not mid-word, not inside a URL fragment), followed by
// a letter/digit then word chars or hyphens. Tags are lowercased so `#Idea` and
// `#idea` are one thread.
const TAG_RE = /(?<![\w#])#([a-z0-9][\w-]*)/gi

/** Distinct, lowercased tags in a body, in first-seen order. */
export function parseTags(body: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of body.matchAll(TAG_RE)) {
    const tag = m[1]!.toLowerCase()
    if (!seen.has(tag)) {
      seen.add(tag)
      out.push(tag)
    }
  }
  return out
}

// Stable per-tag color, so a tag looks the same everywhere it appears.
const TAG_COLORS = ['amber', 'blue', 'green', 'violet', 'rose', 'cyan', 'orange', 'teal']

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function tagColorClass(tag: string): string {
  return `tag-${TAG_COLORS[hash(tag) % TAG_COLORS.length]}`
}
