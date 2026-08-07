# Short links — how this works

Every guide now gets a short, shareable URL like:

    https://thermalsock.github.io/shoelaces/

...which instantly redirects to the real article at:

    https://thermalsock.github.io/rudiment-app/guide/tying-your-shoelaces-properly.html

## Why it needs its own upload step

Short links only work from the bare root domain (`thermalsock.github.io/xyz`),
not from inside the `rudiment-app` project (`thermalsock.github.io/rudiment-app/xyz`)
— the whole point is dropping that `/rudiment-app/` segment. That means the
generated short-link pages have to be uploaded to your **root repo**
(the one literally named `thermalsock.github.io` — same one that already
has `index.html` and `ads.txt` in it), not to `rudiment-app`.

## What to upload

Everything inside the `root-shortlinks/` folder — one subfolder per short
code, each containing its own `index.html`, plus a `_manifest.json` for
your own reference. Upload the *contents* of `root-shortlinks/` into the
root of the `thermalsock.github.io` repo, alongside the existing
`index.html` and `ads.txt`. Don't upload the `root-shortlinks` folder
itself as a subfolder — its contents go straight in the repo root.

After uploading, `https://thermalsock.github.io/shoelaces/` should work
within a minute or two.

## Adding more guides later (this is the future-proof part)

You don't need to do anything by hand. The short-link generator is wired
straight into `generate.py`:

```bash
python3 generate.py
```

This does everything it always did (guide pages, index.html, sitemap.xml)
*and* regenerates the full short-link set into a sibling folder called
`root-shortlinks/`, sitting next to your `rudiment-app` folder. Every new
guide you add to `guides_data.py` automatically gets a short code —
no manual step, ever.

## How a short code gets picked

1. **Manual override (recommended for anything you expect to actually
   share).** Add a `"short"` key to the guide's entry in `guides_data.py`:

   ```python
   {
       "slug": "some-new-guide", "short": "mycode",
       "title": "...", ...
   },
   ```

   26 of the highest-traffic guides already have hand-picked codes this
   way (e.g. `shoelaces`, `firstaid`, `budget`, `sleep`, `consent`).

2. **Automatic fallback (everything else).** If a guide has no `"short"`
   key, one gets derived automatically from the slug — common filler
   words get stripped, and the first couple of meaningful words get
   mashed together (e.g. `basic-first-aid-everyone-should-know` →
   `firstaideveryone`). It won't always be as clean as a hand-picked one,
   but it's always short, unique, and readable enough. Duplicate codes are
   detected and automatically resolved (adding a word, or a number, as a
   last resort) — the generator will never silently overwrite one guide's
   short link with another's.

If you want a nicer code for something that's currently auto-generated,
just add a `"short"` key for it and re-run `generate.py` — the new code
takes over immediately (old links using the auto-generated code will stop
working, so only do this before you've shared it anywhere).

## SEO note

Each short-link redirect page has `<meta name="robots" content="noindex, follow">`
and a `rel="canonical"` pointing at the real guide URL, so Google indexes
the actual article, not the redirect stub — the short links are purely for
sharing, they won't create duplicate-content issues.
