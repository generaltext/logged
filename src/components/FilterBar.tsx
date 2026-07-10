import { Search, X } from 'lucide-react'
import { TagMenu } from './TagMenu'

/**
 * A single compact row: free-text search, a "Tags" popover (toggle filters), and
 * a clear button. Tag filtering is OR across selected tags — "show me anything
 * tagged travel *or* memory".
 */
export function FilterBar({
  tags,
  active,
  search,
  onToggleTag,
  onSearch,
  onClearTags,
  onClear,
}: {
  tags: { tag: string; count: number }[]
  active: Set<string>
  search: string
  onToggleTag: (tag: string) => void
  onSearch: (q: string) => void
  onClearTags: () => void
  onClear: () => void
}) {
  const filtering = active.size > 0 || search.trim().length > 0

  return (
    <div className="flex flex-none items-center gap-2 border-b bg-[var(--panel)] px-4 py-2">
      <Search size={14} style={{ color: 'var(--muted)' }} className="flex-none" />
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search the log…"
        className="min-w-0 flex-1 bg-transparent text-[0.82rem] outline-none placeholder:text-[var(--muted)]"
      />
      <TagMenu tags={tags} active={active} onToggleTag={onToggleTag} onClearTags={onClearTags} />
      {filtering && (
        <button
          type="button"
          onClick={onClear}
          title="Clear all filters"
          className="inline-flex flex-none items-center gap-1 rounded px-1.5 py-1 text-[0.72rem] hover:bg-[var(--hover)]"
          style={{ color: 'var(--muted)' }}
        >
          <X size={11} /> clear
        </button>
      )}
    </div>
  )
}
