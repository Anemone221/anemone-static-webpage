# website

A personal EVE Online page. It shows live status for Tranquility and zKillboard, links I use often, and an introduction to [MCO](https://github.com/Anemone221/MCO).

It's plain HTML, CSS, and JavaScript, with no build step. The status cards are filled in by the browser from public APIs that allow cross-origin requests:

| Card        | Source                                             |
| ----------- | -------------------------------------------------- |
| EVE Online  | `https://status.eveonline.com/api/v2/summary.json` |
| Tranquility | `https://esi.evetech.net/latest/status/`           |
| zKillboard  | `https://zkillboard.com/api/kills/`                |

The status refreshes every 3 minutes while the tab is visible.

## Files

```
index.html        page content
assets/style.css  styles
assets/app.js     live status fetching
assets/mco.png    MCO icon
.nojekyll         stops GitHub Pages from running Jekyll
```

## Run locally

Any static server works. For example:

```sh
python -m http.server 8000
```

Then open http://localhost:8000.
