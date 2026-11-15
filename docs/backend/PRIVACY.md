# Privacy at Silica Station

Silica Station is a game for children. The backend exists so a mission can be
saved and checked, and so grown-ups can see anonymous classroom statistics. It
was designed so that no personal information can be collected, even by mistake.

## What is saved

For each mission:

- the random seed that shaped the scenario
- the live solar-activity bonus (0, 5 or 10) chosen at the start
- the list of choices made, one per round
- the outcome: won, partial, lost, or still playing
- if the crew was lost: whether oxygen or health ran out, and the round
- the final resource meters, score and the mission report the server rebuilt
- when the run started, was last updated and finished
- whether the browser's own summary matched the server's replay

That is all. There are no accounts and no sign-in.

## What is not saved

- names, birthdays, school names or anything typed: the API accepts **no free text**
- IP addresses: the in-memory rate limiter uses a client key only while a request
  is being handled, and it is never written to the database or logs
- cookies, sessions, device identifiers, advertising IDs
- user agents, browser fingerprints, geolocation
- third-party analytics or trackers of any kind

Log lines contain only the timestamp, method, path (without query string),
status, duration and a random request id.

## Why runs are anonymous

A saved run is identified only by a random id created in the browser. It cannot
be linked to a person unless someone deliberately writes the id down. Two
missions from the same device are not linked to each other.

## Checking runs

Every submitted run is replayed on the server with the same game engine the
browser uses. The server never trusts the numbers sent by the browser. If the
browser's summary disagrees with the replay, the run is marked `verified: false`
and is excluded from all statistics.

## Statistics and small groups

`GET /api/stats` returns anonymous totals only. Verified runs from fewer than
five completed missions are suppressed entirely (`suppressed: true`, all values
zero), so one child's mission is never exposed on the "For grown-ups" screen.

## How long data is kept

Runs are deleted after `RETENTION_DAYS` (365 days by default) by a daily sweep.
Deleting a run also deletes its choices.

## How to delete data

- Delete an individual run: remove its row from the `runs` table (choices cascade),
  or call `store.deleteRunsOlderThan` with a cutoff after its last update.
- Delete everything: stop the server and remove the SQLite file in `DATA_DIR`
  (`data/silica.db` plus its `-wal` and `-shm` files).
- Keep nothing at all: leave `DATA_DIR` on an ephemeral disk, or block
  `/api/runs` and `/api/stats`; the game works fully without the backend.

The game itself never depends on the backend: if every API call fails, the
mission plays exactly as before and unsent runs wait in the browser's own
`localStorage` until they can be retried (at most 20).
