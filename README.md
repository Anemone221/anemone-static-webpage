# website

A personal EVE Online page. It shows live status for Tranquility and zKillboard, links I use often, and an introduction to [MCO](https://github.com/Anemone221/MCO).

It's plain HTML, CSS, and JavaScript, with no build step. The status cards are filled in by the browser from public APIs that allow cross-origin requests:

| Card | Source |
| --- | --- |
| EVE Online | `https://status.eveonline.com/api/v2/summary.json` |
| Tranquility | `https://esi.evetech.net/latest/status/` |
| zKillboard | `https://zkillboard.com/api/kills/` |

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

## Deploy: GitHub Pages and a Cloudflare domain

1. **Push the folder to GitHub.** For example, push it to `Anemone221/anemone-static-webpage` on the `main` branch.
2. **Turn on Pages.** In the repo, go to **Settings → Pages → Build and deployment**. Set the source to **Deploy from a branch**, the branch to `main`, and the folder to `/ (root)`.
3. **Set the custom domain.** On the same page, confirm **Custom domain** shows `geckostate.net` (it comes from the `CNAME` file in this repo).
4. **Add the DNS records in Cloudflare** (**DNS → Records**):

   | Type | Name | Target | Proxy |
   | --- | --- | --- | --- |
   | CNAME | `@` | `anemone221.github.io` | DNS only (grey cloud) |
   | CNAME | `www` | `anemone221.github.io` | DNS only (grey cloud) |

   Cloudflare flattens the CNAME on the root (`@`) automatically. If you'd rather use A records for `@`, point them at `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`.
5. **Wait for HTTPS.** GitHub checks the DNS and issues a certificate, which can take from a few minutes to an hour. When it's done, tick **Enforce HTTPS** in the Pages settings.
6. **Optional: turn on Cloudflare's proxy.** You can switch the records to Proxied (orange cloud) once HTTPS works. Before you do, set **SSL/TLS → Overview** to **Full**. Using **Flexible** causes a redirect loop.

Optional: to stop other people from claiming your domain on GitHub Pages, verify it under your GitHub account's **Settings → Pages → Add a domain**.
