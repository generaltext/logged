import { useMemo, useState } from 'react'
import { useStore } from './lib/store'
import { actorCount, liveEntries, tagCounts, type EntryRecord } from './lib/reducer'
import { parseTags } from './lib/tags'
import { newId } from './lib/ids'
import { Header } from './components/Header'
import { FilterBar } from './components/FilterBar'
import { Stream } from './components/Stream'
import { Composer } from './components/Composer'

export function App() {
  const { ready, connected, state, version, dispatch, presentUsers, typingUsers, setTyping } =
    useStore()
  const [active, setActive] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const entries = useMemo(() => liveEntries(state), [state, version])
  const tags = useMemo(() => tagCounts(state), [state, version])
  const showActor = useMemo(() => actorCount(state) > 1, [state, version])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((e: EntryRecord) => {
      // OR across selected tags; AND with the search text.
      if (active.size > 0 && !e.tags.some((t) => active.has(t))) return false
      if (q && !e.body.toLowerCase().includes(q)) return false
      return true
    })
  }, [entries, active, search])

  // A stable key so the Stream can tell "the filter changed" from "new entry".
  const filterKey = useMemo(
    () => [...active].sort().join(',') + '|' + search.trim().toLowerCase(),
    [active, search],
  )

  function toggleTag(tag: string) {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function clearTags() {
    setActive(new Set())
  }

  function clearFilters() {
    setActive(new Set())
    setSearch('')
  }

  function record(body: string) {
    void dispatch({
      type: 'log.entry',
      subject: newId('ent'),
      data: { body, tags: parseTags(body) },
    })
  }

  function editEntry(id: string, body: string) {
    void dispatch({ type: 'log.edit', subject: id, data: { body, tags: parseTags(body) } })
  }

  function deleteEntry(id: string) {
    void dispatch({ type: 'log.delete', subject: id })
  }

  return (
    <div className="flex h-full flex-col">
      <Header connected={connected} presentUsers={presentUsers} />
      <FilterBar
        tags={tags}
        active={active}
        search={search}
        onToggleTag={toggleTag}
        onSearch={setSearch}
        onClearTags={clearTags}
        onClear={clearFilters}
      />
      {ready ? (
        <Stream
          entries={filtered}
          filterKey={filterKey}
          showActor={showActor}
          onToggleTag={toggleTag}
          onEdit={editEntry}
          onDelete={deleteEntry}
        />
      ) : (
        <div className="min-h-0 flex-1" />
      )}
      <Composer onSubmit={record} onTyping={setTyping} typingUsers={typingUsers} />
    </div>
  )
}
