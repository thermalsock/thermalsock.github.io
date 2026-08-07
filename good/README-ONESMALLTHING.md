# One Small Thing — setup

## What this is

A single, self-contained page. Everyone who visits on a given UTC day sees
the same one prompt — deterministically picked from the date itself, the
same technique Wordle uses, so there's no server or database needed for
"everyone gets today's thing" to be true simultaneously for everyone on
Earth. Streaks live only in the visitor's own browser (localStorage) —
nothing is ever sent anywhere.

## Files

- `index.html` — the whole site. CSS and JS are inlined directly into this
  file, so it's genuinely one file with zero external requests once
  loaded (faster, and nothing to break).
- `css/style.css`, `js/prompts.js`, `js/app.js` — the *source* versions of
  the same content, kept separate for easier editing. If you change any of
  these, you need to re-inline them into `index.html` (see below) — editing
  `index.html` directly and forgetting to update the source files (or vice
  versa) is the one way this setup could quietly drift out of sync.

## Uploading

Same pattern as your other projects: upload this into a `good/` subfolder
of your existing root repo (`thermalsock.github.io`), so it lives at
`https://thermalsock.github.io/good/`. Same domain, same AdSense
verification already in place — nothing new to set up there.

## Adding more prompts later

Open `js/prompts.js`, add a new string to the `PROMPTS` array, save.
That's it — no rebuild step, no regeneration script, because this isn't a
multi-page generated site like your other two projects. If you only edit
the source `js/prompts.js` file, remember you'll need to also re-inline it
into `index.html` (or just switch `index.html` back to loading the
external `css/style.css` + `js/prompts.js` + `js/app.js` files instead of
inline — either works, inlining is just a minor performance nicety, not a
requirement).

## On ads, specifically for this page

I deliberately did NOT wire in Auto ads or the AdSense loader here, unlike
your other two sites. Worth doing deliberately, not automatically:

This page's entire pitch is "somewhere on the internet that isn't trying
to hook you." A page cluttered with multiple auto-placed ad units directly
undermines that in a way that would be actively embarrassing if this ever
did get shared widely — imagine someone screenshotting "close the tab, go
be present" next to three banner ads. If you want any monetization here at
all, I'd suggest exactly one small, static, manually-placed ad unit,
positioned only in the "done" state (after someone's already engaged),
never above or beside the actual prompt. That's a design opinion, not a
technical requirement — the site works identically either way.

## Two real bugs found and fixed during testing

Worth knowing about since they're the kind of thing that could recur if
you add new JS to this page later:

1. `async function` syntax anywhere in a `<script>` block will silently
   break the *entire* block on some older browser engines (a parse-time
   failure, not a runtime one) — rewritten using plain `.then()`/`.catch()`
   Promise chains instead, which work everywhere.
2. `String.prototype.padStart` isn't universally available on older
   engines either — replaced with a two-line manual zero-pad function.

Modern real-world browsers (current Chrome, Firefox, Safari, Edge) support
both of these fine, so this was arguably being extra-cautious rather than
fixing something that would have failed for actual visitors — but given
this page might plausibly get shared to a wide, unpredictable mix of
devices and browsers if it ever does spread, maximum compatibility felt
like the right call rather than assuming everyone's on the latest browser.
