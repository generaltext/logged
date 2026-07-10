import { useEffect, useState } from 'react'
import type { PresenceUser } from '../lib/store'
import { initials } from '../lib/format'

// A live local clock, ticking once a second — a quiet terminal cue in the header.
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function Header({
  connected,
  presentUsers,
}: {
  connected: boolean
  presentUsers: PresenceUser[]
}) {
  const now = useNow()
  const clock = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return (
    <header className="flex flex-none items-center gap-3 border-b bg-[var(--panel)] px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold tracking-[0.2em]" style={{ color: 'var(--accent)' }}>
          LOGGED
        </span>
      </div>
      {/* who's here now (shared logs only) */}
      {presentUsers.length > 1 && (
        <div className="ml-3 flex items-center -space-x-1.5">
          {presentUsers.slice(0, 5).map((u) => (
            <span
              key={u.id}
              className="grid h-5 w-5 place-items-center rounded-full text-[0.55rem] font-bold text-white"
              style={{ background: u.color, boxShadow: '0 0 0 2px var(--panel)' }}
              title={`${u.name} · here now`}
            >
              {initials(u.name)}
            </span>
          ))}
          {presentUsers.length > 5 && (
            <span
              className="grid h-5 w-5 place-items-center rounded-full text-[0.55rem] font-bold"
              style={{
                background: 'var(--hover)',
                color: 'var(--muted)',
                boxShadow: '0 0 0 2px var(--panel)',
              }}
              title={`${presentUsers.length - 5} more here`}
            >
              +{presentUsers.length - 5}
            </span>
          )}
        </div>
      )}
      <div
        className="ml-auto flex items-center gap-3 tabular-nums"
        style={{ color: 'var(--muted)', fontSize: '0.72rem' }}
      >
        <span>{clock}</span>
        <span
          className="inline-block h-2 w-2 rounded-full"
          title={connected ? 'Synced' : 'Offline'}
          style={{
            background: connected ? 'var(--accent)' : 'var(--muted)',
            boxShadow: connected ? '0 0 6px var(--accent)' : 'none',
          }}
        />
      </div>
    </header>
  )
}
