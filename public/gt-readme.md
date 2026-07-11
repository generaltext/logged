# Logged

A captain's log for capturing ideas. Dense, timestamped, and built for speed: one input
at the bottom of the screen, always ready. You type, you hit enter, and the moment is
**logged** onto the top of the stack, stamped with the time and who wrote it.

It's a catchall for the things that usually slip away: a spark of an idea, a memory, a
thing someone said, a note to your future self. No folders, no titles, no filing. Just a
running stream you can scroll back through.

## Tagging without slowing down

Structure is inline and free: type `#idea` or `#saltbark` anywhere in an entry and it
becomes a tag. Later, tap any hashtag to collapse the whole log to just that thread. No
tag picker, no fields — you never leave the keyboard to categorize.

## Shared or solo

Because Logged runs on General Text's sync, a log can be **shared**: a team's running
log, a shared journal, a group stream. Every line is stamped with who wrote it, and you
see each other's entries appear live. Solo is just the one-person case of the same thing.

## How your data is stored

Logged is **append-only**: every entry (and every later edit or deletion) is one JSON
line added to a monthly log file, and the stream you see is rebuilt by replaying them.
That means clean merges when several people write at once, and a full, honest history —
corrections are recorded, never silently overwritten.

Files it writes, all under this app's `data/` folder:

- `v0/log/YYYY-MM.jsonl` — the append-only log (the source of truth).

Because the store is plain JSONL, you can `grep` it, diff it in git, or hand it to an LLM
without Logged in the loop ("what was I thinking about in June?"). The file is the contract.
