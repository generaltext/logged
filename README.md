# Logged

A captain's log for capturing ideas — dense, timestamped, hashtag-filtered — built as a
[General Text](https://www.generaltext.org) app. One input pinned to the bottom; you
type, hit enter, and the moment is logged onto the top of the stack.

Built against the app guide: https://www.generaltext.org/llms.txt
(local source: `projects/generaltext/content/docs/building-apps.md`). Design plan:
`planning/apps/logged/init.md` in the gt-meta repo.

## Develop

```bash
pnpm install
pnpm dev        # vite dev server; window.gt is injected in dev
pnpm test       # vitest — the tags/reducer/log spine
pnpm typecheck
pnpm build      # tsc --noEmit && vite build → dist/ (gt.json at root, relative assets)
```

In dev, a tiny Vite plugin injects the public General Text runtime, so the app runs
standalone against a **local in-browser workspace** (IndexedDB + cross-tab sync). Open
two tabs to watch entries merge live. No account, no server. To test inside real General
Text, `vite preview` and install by URL (Settings → Apps → Install by URL).

## Architecture: event-sourced, one stream

The source of truth is an **append-only event log**; the UI is a **materialized
projection** rebuilt by folding it. An append-only JSONL log is the structure that merges
cleanest under General Text's character-level CRDT — and a captain's log is natively
append-only, so this is the platform's happy path. Just three event types:

- `log.entry` — a new line in the stream (`{ body, tags }`). ~99% of events.
- `log.edit` — replace the text of an earlier entry (last-writer-wins by `ts`).
- `log.delete` — tombstone an earlier entry (hidden, kept in history).

Edits and deletes are **new events**, never rewrites — that's what keeps concurrent
appends merging cleanly and the cache correct.

- **`lib/events.ts`** — the event envelope (`{ id, ts, actor, type, subject, data }`).
- **`lib/tags.ts`** — inline `#hashtag` parsing (the only structuring mechanism) and the
  render tokenizer (text / tag / url), sharing one boundary rule.
- **`lib/reducer.ts`** — folds events → the live entry stream; idempotent (dedupe by
  event id) so optimistic writes and re-folds are safe. Stream order is each entry's
  original `createdAt`, stable across edits.
- **`lib/log.ts`** — monthly JSONL shards (`v0/log/YYYY-MM.jsonl`), safe appends, and
  incremental tail folding.
- **`lib/cache.ts`** — a disposable IndexedDB materialization cache (hydrate instantly,
  re-parse only the new tail). The log is always the truth.
- **`lib/store.tsx`** — boots the runtime, subscribes shards, dispatches events (safe
  append based on freshest content), seeds the live demo, exposes `useStore()`.

The UI is one screen: `Header` (title + stardate clock + sync dot), `FilterBar` (tag
chips + search), `Stream` (day-divided, bottom-anchored, stay-pinned scroll with a "↓ N
new" pill), and `Composer` (the always-there bottom input; Enter records, Shift+Enter
newlines, `/` focuses).

## Files written (all under this app's `data/`)

- `v0/log/YYYY-MM.jsonl` — the append-only log (source of truth).

Never edit a shard line in place — corrections are new events.
