# The Vault — setup

## What this is

A daily 4-digit code-cracking game. Same secret code for everyone on Earth
on a given UTC day — computed deterministically from the date itself (the
same technique Wordle uses), so no server or database is needed for that
to be true simultaneously for everyone. Six guesses, Mastermind-style
feedback. Streaks live only in the visitor's own browser.

## Files

- `index.html` — the whole game. CSS and the game logic are inlined
  directly into this file (single file, zero external requests once
  loaded).
- `game-logic.js` — the same core logic as a standalone file, kept
  separate for easier editing and so it can be unit-tested independently
  of the page. If you change it, re-inline it into `index.html` (see
  below), or just switch `index.html` back to loading it externally via
  `<script src="game-logic.js"></script>` — either works.

## Uploading

Same pattern as your other projects — upload into a `vault/` subfolder of
your root repo (`thermalsock.github.io`), so it lands at
`https://thermalsock.github.io/vault/`. Same domain, same AdSense
verification already in place.

## Testing before you touch anything

`game-logic.js` has a full test suite proving the scoring algorithm,
date-seeded randomness, streak logic, and share-text generation all behave
correctly — including tricky edge cases like duplicate digits in a guess
and leap-year date boundaries. If you ever modify the game logic, it's
worth re-running that suite before uploading. (The test file itself isn't
included in this folder since it's a development tool, not part of the
site — ask if you want it re-supplied.)

## Changing the difficulty or rules

A few easy knobs, all in `game-logic.js` / `index.html`:
- `GUESS_LIMIT` (in `index.html`) — currently 6, change to make it
  harder/easier.
- `CODE_LEN` (in `index.html`) — currently 4 digits. Could go to 5, though
  the keypad/tile layout is currently sized for 4.
- The code is always 4 *unique* digits by design (no repeats in the
  secret) — this was a deliberate choice for cleaner logic, not a
  limitation you need to work around.

## On ads

Not wired in on this one either, same reasoning as One Small Thing — a
game people are actually enjoying is a bad place to bolt on Auto ads
without thinking about it first. If you want monetization here, I'd
suggest a single small ad below the result panel, shown only after
someone's finished the day's puzzle — never above the board, never
mid-game.
